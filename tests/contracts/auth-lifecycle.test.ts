/// <reference types="node" />
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Runtime } from '../../src/services/contracts';
import { createJsonAuthRepository, DEMO_PASSPHRASE } from '../../src/services/json/auth';
import { fixtureUsers, readIdentities } from '../../src/services/json/identities';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';

const email = 'demo@example.com';
const replacement = 'ChangedDemo123!';
function setup(verified = false) {
  let timestamp = Date.parse('2026-10-24T00:00:00Z');
  let serial = 0;
  const runtime: Runtime = {
    now: () => new Date(timestamp),
    id: (prefix = 'id') => `${prefix}-${++serial}`,
  };
  const local = new MemoryStorage();
  const tab = new MemoryStorage();
  const store = createPersistence(local, runtime);
  const sessionStore = createPersistence(tab, runtime);
  const users = fixtureUsers().map((user) => ({ ...user, verified }));
  return {
    local,
    tab,
    store,
    sessionStore,
    auth: createJsonAuthRepository({
      store,
      sessionStore,
      runtime,
      users,
      crypto: webcrypto as unknown as Crypto,
    }),
    advance: (milliseconds: number) => {
      timestamp += milliseconds;
    },
  };
}
const reset = (intentId: string, password = replacement) => ({
  intentId,
  password,
  confirmPassword: password,
});
function serialized(storage: MemoryStorage) {
  return Array.from({ length: storage.length }, (_, index) =>
    storage.getItem(storage.key(index)!),
  ).join('');
}

describe('demo recovery, verification and password lifecycle', () => {
  it('returns generic known/unknown reset feedback without sending email or making a request', async () => {
    const context = setup();
    const transport = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected network request'));
    try {
      const known = await context.auth.requestReset(' DEMO@EXAMPLE.COM ');
      const unknown = await context.auth.requestReset('missing@example.com');
      expect(known.message).toBe(unknown.message);
      expect(known.message).toMatch(/demo.*no email was sent/i);
      expect(known.demoIntentId).toMatch(/^reset-\d+$/);
      expect(unknown.demoIntentId).toMatch(/^reset-\d+$/);
      expect(known.demoIntentId).not.toBe(unknown.demoIntentId);
      expect(transport).not.toHaveBeenCalled();
      expect(serialized(context.tab)).not.toContain('missing@example.com');
    } finally {
      transport.mockRestore();
    }
  });

  it('changes the verifier through a reset and invalidates old sessions and credentials', async () => {
    const context = setup();
    await context.auth.login({ email, password: DEMO_PASSPHRASE, remember: true });
    const intent = await context.auth.requestReset(email);
    await context.auth.resetDemoPassword(reset(intent.demoIntentId));
    expect(await context.auth.getSession()).toBeNull();
    expect(context.local.getItem('bdsolarenergy:session')).toBeNull();
    expect(context.tab.getItem('bdsolarenergy:session')).toBeNull();
    const identity = readIdentities(context.store).find((record) => record.user.id === 'user-demo');
    expect(identity?.credential?.algorithm).toBe('PBKDF2-SHA-256');
    expect(identity?.credential?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized(context.local) + serialized(context.tab)).not.toContain(replacement);
    await expect(
      context.auth.login({ email, password: DEMO_PASSPHRASE, remember: false }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      context.auth.login({ email, password: replacement, remember: false }),
    ).resolves.toMatchObject({ userId: 'user-demo' });
  });

  it('consumes a reset intent once and does not apply a second replacement', async () => {
    const context = setup();
    const intent = await context.auth.requestReset(email);
    await context.auth.resetDemoPassword(reset(intent.demoIntentId));
    await expect(
      context.auth.resetDemoPassword(reset(intent.demoIntentId, 'AnotherPass123!')),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      context.auth.login({ email, password: replacement, remember: false }),
    ).resolves.toMatchObject({ userId: 'user-demo' });
    await expect(
      context.auth.login({ email, password: 'AnotherPass123!', remember: false }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('rejects an intent at its expiry boundary without changing the existing credential', async () => {
    const context = setup();
    const intent = await context.auth.requestReset(email);
    const previous = readIdentities(context.store);
    context.advance(15 * 60_000);
    await expect(context.auth.resetDemoPassword(reset(intent.demoIntentId))).rejects.toMatchObject({
      code: 'validation',
    });
    expect(readIdentities(context.store)).toEqual(previous);
    await expect(
      context.auth.login({ email, password: DEMO_PASSPHRASE, remember: false }),
    ).resolves.toMatchObject({ userId: 'user-demo' });
  });

  it('rejects a wrong current password without replacing credentials', async () => {
    const context = setup();
    await context.auth.login({ email, password: DEMO_PASSPHRASE, remember: false });
    const previous = readIdentities(context.store);
    await expect(
      context.auth.changeDemoPassword({
        currentPassword: 'WrongPass123!',
        password: replacement,
        confirmPassword: replacement,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(readIdentities(context.store)).toEqual(previous);
    expect((await context.auth.getSession())?.userId).toBe('user-demo');
  });

  it('changes an authenticated password without persisting plaintext or switching identity', async () => {
    const context = setup();
    const session = await context.auth.login({ email, password: DEMO_PASSPHRASE, remember: false });
    await context.auth.changeDemoPassword({
      currentPassword: DEMO_PASSPHRASE,
      password: replacement,
      confirmPassword: replacement,
    });
    expect(await context.auth.getSession()).toEqual(session);
    expect(
      readIdentities(context.store).find((record) => record.user.id === session.userId)?.credential
        ?.salt,
    ).toMatch(/^[a-f0-9]{32}$/);
    expect(serialized(context.local) + serialized(context.tab)).not.toContain(replacement);
    await context.auth.logout();
    await expect(
      context.auth.login({ email, password: DEMO_PASSPHRASE, remember: false }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      context.auth.login({ email, password: replacement, remember: false }),
    ).resolves.toMatchObject({ userId: session.userId });
  });

  it('reports guest and simulated verification status without claiming email delivery', async () => {
    const context = setup();
    expect(await context.auth.getVerificationStatus()).toEqual({ status: 'guest', demoOnly: true });
    await context.auth.login({ email, password: DEMO_PASSPHRASE, remember: false });
    expect(await context.auth.getVerificationStatus()).toEqual({
      status: 'unverified',
      demoOnly: true,
    });
    const verified = setup(true);
    await verified.auth.login({ email, password: DEMO_PASSPHRASE, remember: false });
    expect(await verified.auth.getVerificationStatus()).toEqual({
      status: 'verified',
      demoOnly: true,
    });
  });

  it('rejects missing reset intents, unauthenticated changes and cancelled verification reads', async () => {
    const context = setup();
    await expect(context.auth.resetDemoPassword(reset('missing-intent'))).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(
      context.auth.changeDemoPassword({
        currentPassword: DEMO_PASSPHRASE,
        password: replacement,
        confirmPassword: replacement,
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      context.auth.getVerificationStatus({ signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
