/// <reference types="node" />
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createJsonAuthRepository, DEMO_PASSPHRASE } from '../../src/services/json/auth';
import { readIdentities, writeIdentities } from '../../src/services/json/identities';
import { createPersistence, MemoryStorage } from '../../src/services/persistence/store';
import type { Runtime } from '../../src/services/contracts';

function setup() {
  let now = new Date('2026-10-24T00:00:00Z');
  let serial = 0;
  const runtime: Runtime = { now: () => now, id: (prefix = 'id') => `${prefix}-${++serial}` };
  const native = new MemoryStorage();
  const sessionNative = new MemoryStorage();
  const store = createPersistence(native, runtime);
  const sessionStore = createPersistence(sessionNative, runtime);
  const create = (sessions = sessionStore) =>
    createJsonAuthRepository({
      store,
      sessionStore: sessions,
      runtime,
      crypto: webcrypto as unknown as Crypto,
    });
  return {
    store,
    sessionStore,
    native,
    sessionNative,
    runtime,
    create,
    auth: create(),
    advance: () => {
      now = new Date('2027-10-24T00:00:00Z');
    },
  };
}
const registration = (email = 'new@example.com') => ({
  displayName: 'নতুন Customer',
  email,
  password: 'Private123!abcd',
  confirmPassword: 'Private123!abcd',
  acceptTerms: true,
});

describe('demo authentication contract', () => {
  it('logs in a normalized public demo identity and returns only session metadata', async () => {
    const context = setup();
    const session = await context.auth.login({
      email: '  DEMO@EXAMPLE.COM ',
      password: DEMO_PASSPHRASE,
      remember: false,
    });
    expect(session.userId).toBe('user-demo');
    expect(Object.keys(session).sort()).toEqual(['expiresAt', 'userId']);
    expect(await context.auth.getSession()).toEqual(session);
    expect(context.native.getItem('bdsolarenergy:session')).toBeNull();
    expect(context.sessionNative.getItem('bdsolarenergy:session')).not.toBeNull();
  });
  it('uses the same credential failure for wrong password and unknown email', async () => {
    const { auth } = setup();
    const first = await auth
      .login({ email: 'demo@example.com', password: 'wrong', remember: false })
      .catch((error) => error);
    const second = await auth
      .login({ email: 'missing@example.com', password: 'wrong', remember: false })
      .catch((error) => error);
    expect(first.code).toBe('validation');
    expect(second.message).toBe(first.message);
  });
  it('registers salted verifiers without plaintext password persistence', async () => {
    const context = setup();
    const input = registration();
    const session = await context.auth.register(input);
    expect((await context.auth.getSession())?.userId).toBe(session.userId);
    await context.auth.register(registration('second-new@example.com'));
    const identities = readIdentities(context.store).filter(
      (identity) => identity.credential !== null,
    );
    expect(identities).toHaveLength(2);
    expect(identities[0].credential?.salt).not.toBe(identities[1].credential?.salt);
    expect(identities[0].credential?.hash).not.toBe(identities[1].credential?.hash);
    expect(identities[0].credential?.iterations).toBeGreaterThanOrEqual(100000);
    for (const storage of [context.native, context.sessionNative]) {
      const raw = Array.from({ length: storage.length }, (_, i) =>
        storage.getItem(storage.key(i)!),
      ).join('');
      expect(raw).not.toContain(input.password);
    }
    await context.auth.logout();
    await expect(
      context.auth.login({ email: input.email, password: input.password, remember: false }),
    ).resolves.toMatchObject({ userId: session.userId });
  });
  it('rejects duplicate normalized emails including concurrent registrations', async () => {
    const { auth } = setup();
    const results = await Promise.allSettled([
      auth.register(registration()),
      auth.register(registration('NEW@EXAMPLE.COM')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason.code).toBe('conflict');
  });
  it('restores remembered sessions but not session-only sessions after a new tab session', async () => {
    const context = setup();
    await context.auth.login({
      email: 'demo@example.com',
      password: DEMO_PASSPHRASE,
      remember: false,
    });
    const freshSession = createPersistence(new MemoryStorage(), context.runtime);
    expect(await context.create(freshSession).getSession()).toBeNull();
    await context.auth.login({
      email: 'demo@example.com',
      password: DEMO_PASSPHRASE,
      remember: true,
    });
    expect((await context.create(freshSession).getSession())?.userId).toBe('user-demo');
    expect(context.sessionNative.getItem('bdsolarenergy:session')).toBeNull();
  });
  it('expires sessions and rejects metadata for missing identities', async () => {
    const context = setup();
    await context.auth.login({
      email: 'demo@example.com',
      password: DEMO_PASSPHRASE,
      remember: true,
    });
    context.advance();
    expect(await context.auth.getSession()).toBeNull();
    expect(context.native.getItem('bdsolarenergy:session')).toBeNull();
    await context.auth.login({
      email: 'demo@example.com',
      password: DEMO_PASSPHRASE,
      remember: false,
    });
    writeIdentities(context.store, []);
    expect(await context.auth.getSession()).toBeNull();
  });
  it('clears both remembered and session-only metadata at logout', async () => {
    const context = setup();
    await context.auth.login({
      email: 'demo@example.com',
      password: DEMO_PASSPHRASE,
      remember: true,
    });
    await context.auth.logout();
    expect(await context.auth.getSession()).toBeNull();
    expect(context.native.getItem('bdsolarenergy:session')).toBeNull();
    expect(context.sessionNative.getItem('bdsolarenergy:session')).toBeNull();
  });
  it('honors pre-cancelled session reads', async () => {
    const context = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(context.auth.getSession({ signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
