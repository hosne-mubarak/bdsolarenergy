import { z } from 'zod';
import {
  changePasswordInputSchema,
  emailSchema,
  loginInputSchema,
  registerInputSchema,
  resetIntentSchema,
  resetPasswordInputSchema,
  sessionSchema,
} from '../../schemas';
import type { Session, StoredIdentity, User } from '../../types';
import type { AuthRepository, ReadOptions, Runtime } from '../contracts';
import { RepositoryError, normalizeRepositoryError, throwIfAborted } from '../errors';
import type { Persistence } from '../persistence/store';
import { validateInput } from '../validation';
import { createVerifier, verifyPassword } from '../auth/verifier';
import { fixtureUsers, readIdentities, writeIdentities } from './identities';

/** Public, intentionally bundled demo access. Never use this passphrase for a real account. */
export const DEMO_PASSPHRASE = 'SolarDemo123!';
const sessionValueSchema = sessionSchema.nullable();
const intentsSchema = z.array(resetIntentSchema);
const invalidCredentials = () =>
  new RepositoryError('validation', 'Email or password is incorrect.');
const resetMessage =
  'This is a demo. If a matching local account exists, a temporary demo reset action is available. No email was sent.';

export interface AuthDependencies {
  store: Persistence;
  sessionStore: Persistence;
  runtime: Runtime;
  users?: User[];
  crypto?: Crypto;
}
export function createJsonAuthRepository({
  store,
  sessionStore,
  runtime,
  users = fixtureUsers(),
  crypto: cryptoProvider = globalThis.crypto,
}: AuthDependencies): AuthRepository {
  async function operation<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw normalizeRepositoryError(error);
    }
  }
  const identities = () => readIdentities(store, users);
  const localSession = () => store.read<Session | null>('session', sessionValueSchema, () => null);
  const tabSession = () =>
    sessionStore.read<Session | null>('session', sessionValueSchema, () => null);
  function restoreSession(destination: Persistence, previous: Session | null) {
    if (previous) destination.write('session', sessionSchema, previous);
    else destination.remove('session');
  }
  function startSession(userId: string, remember: boolean): Session {
    const session: Session = {
      userId,
      expiresAt: new Date(runtime.now().getTime() + (remember ? 7 : 1) * 86_400_000).toISOString(),
    };
    const target = remember ? store : sessionStore;
    const other = remember ? sessionStore : store;
    const previous = remember ? localSession() : tabSession();
    target.write('session', sessionSchema, session);
    try {
      other.remove('session');
    } catch (error) {
      try {
        restoreSession(target, previous);
      } catch {
        /* Preserve the original failure; never return a false login success. */
      }
      throw error;
    }
    return session;
  }
  function clearSessions() {
    sessionStore.remove('session');
    store.remove('session');
  }
  async function readSession(options?: ReadOptions): Promise<Session | null> {
    throwIfAborted(options?.signal);
    await Promise.resolve();
    throwIfAborted(options?.signal);
    const current = tabSession() ?? localSession();
    if (!current) return null;
    const exists = identities().some((identity) => identity.user.id === current.userId);
    if (!exists || Date.parse(current.expiresAt) <= runtime.now().getTime()) {
      clearSessions();
      return null;
    }
    return current;
  }
  async function matches(identity: StoredIdentity, password: string) {
    if (identity.credential) return verifyPassword(password, identity.credential, cryptoProvider);
    return (
      users.some((seed) => seed.id === identity.user.id && seed.email === identity.user.email) &&
      password === DEMO_PASSPHRASE
    );
  }
  async function currentIdentity() {
    const session = await readSession();
    if (!session) throw new RepositoryError('unauthenticated');
    const identity = identities().find((candidate) => candidate.user.id === session.userId);
    if (!identity) throw new RepositoryError('unauthenticated');
    return identity;
  }
  const repository: AuthRepository = {
    getSession: (options) => operation(() => readSession(options)),
    getDemoAccess: (options) =>
      operation(async () => {
        throwIfAborted(options?.signal);
        await Promise.resolve();
        throwIfAborted(options?.signal);
        const user = users[0];
        return user ? { email: user.email, passphrase: DEMO_PASSPHRASE, demoOnly: true } : null;
      }),
    login: (input) =>
      operation(async () => {
        const parsed = validateInput(loginInputSchema, input);
        const identity = identities().find((candidate) => candidate.user.email === parsed.email);
        if (!identity || !(await matches(identity, parsed.password))) throw invalidCredentials();
        return startSession(identity.user.id, parsed.remember);
      }),
    register: (input) =>
      operation(async () => {
        const parsed = validateInput(registerInputSchema, input);
        const duplicate = () =>
          new RepositoryError('conflict', 'An account with this email already exists.', {
            email: ['Use a different email or sign in.'],
          });
        if (identities().some((identity) => identity.user.email === parsed.email))
          throw duplicate();
        const credential = await createVerifier(parsed.password, cryptoProvider);
        // Resolve current records again after the asynchronous verifier, preventing lost registrations.
        const previous = identities();
        if (previous.some((identity) => identity.user.email === parsed.email)) throw duplicate();
        const user: User = {
          id: runtime.id('user'),
          displayName: parsed.displayName,
          email: parsed.email,
          phone: '',
          demo: true,
          verified: false,
        };
        writeIdentities(store, [...previous, { user, credential }]);
        try {
          return startSession(user.id, false);
        } catch (error) {
          try {
            writeIdentities(store, previous);
          } catch {
            /* Storage failures remain visible; a partial local account may need sign-in or reset. */
          }
          throw error;
        }
      }),
    logout: () =>
      operation(async () => {
        clearSessions();
      }),
    getVerificationStatus: (options) =>
      operation(async () => {
        const session = await readSession(options);
        if (!session) return { status: 'guest', demoOnly: true };
        return {
          status: identities().find((identity) => identity.user.id === session.userId)?.user
            .verified
            ? 'verified'
            : 'unverified',
          demoOnly: true,
        };
      }),
    requestReset: (email) =>
      operation(async () => {
        const normalized = validateInput(emailSchema, email);
        const identity = identities().find((candidate) => candidate.user.email === normalized);
        const demoIntentId = runtime.id('reset');
        // Unknown accounts receive the same response and identifier format; no email is delivered.
        if (identity) {
          const intents = sessionStore.read('reset-intents', intentsSchema, () => []);
          const live = intents.filter(
            (intent) =>
              intent.userId !== identity.user.id &&
              Date.parse(intent.expiresAt) > runtime.now().getTime() &&
              !intent.used,
          );
          sessionStore.write('reset-intents', intentsSchema, [
            ...live,
            {
              id: demoIntentId,
              userId: identity.user.id,
              expiresAt: new Date(runtime.now().getTime() + 15 * 60_000).toISOString(),
              used: false,
            },
          ]);
        }
        return { message: resetMessage, demoIntentId };
      }),
    resetDemoPassword: (input) =>
      operation(async () => {
        const parsed = validateInput(resetPasswordInputSchema, input);
        const getIntents = () => sessionStore.read('reset-intents', intentsSchema, () => []);
        const initial = getIntents().find((intent) => intent.id === parsed.intentId);
        const invalid = () =>
          new RepositoryError(
            'validation',
            'The demo reset action is invalid, expired or already used. Request another demo reset.',
          );
        if (!initial || initial.used || Date.parse(initial.expiresAt) <= runtime.now().getTime())
          throw invalid();
        const credential = await createVerifier(parsed.password, cryptoProvider);
        const intents = getIntents();
        const intent = intents.find((candidate) => candidate.id === parsed.intentId);
        if (!intent || intent.used || Date.parse(intent.expiresAt) <= runtime.now().getTime())
          throw invalid();
        const records = identities();
        const index = records.findIndex((identity) => identity.user.id === intent.userId);
        if (index < 0) throw invalid();
        // Consume before mutating credentials, so concurrent calls cannot reuse an intent.
        sessionStore.write(
          'reset-intents',
          intentsSchema,
          intents.map((candidate) =>
            candidate.id === intent.id ? { ...candidate, used: true } : candidate,
          ),
        );
        records[index] = { ...records[index], credential };
        writeIdentities(store, records);
        clearSessions();
      }),
    changeDemoPassword: (input) =>
      operation(async () => {
        const parsed = validateInput(changePasswordInputSchema, input);
        const initial = await currentIdentity();
        if (!(await matches(initial, parsed.currentPassword))) throw invalidCredentials();
        const credential = await createVerifier(parsed.password, cryptoProvider);
        const current = await currentIdentity();
        if (current.user.id !== initial.user.id)
          throw new RepositoryError('conflict', 'Your session changed. Please retry.');
        const records = identities();
        const index = records.findIndex((identity) => identity.user.id === current.user.id);
        records[index] = { ...records[index], credential };
        writeIdentities(store, records);
      }),
  };
  return repository;
}
