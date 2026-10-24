import type { Credential } from '../../types';
import { RepositoryError } from '../errors';

const iterations = 150_000;
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}
function bytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
}
function available(cryptoProvider: Crypto) {
  if (!cryptoProvider?.subtle || !cryptoProvider.getRandomValues)
    throw new RepositoryError(
      'unavailable',
      'Demo password verification requires a secure browser context.',
    );
}
async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  rounds: number,
  cryptoProvider: Crypto,
) {
  available(cryptoProvider);
  const key = await cryptoProvider.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    new Uint8Array(
      await cryptoProvider.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds },
        key,
        256,
      ),
    ),
  );
}

/** Browser-controlled verifiers are for demonstration only, never production authentication. */
export async function createVerifier(
  password: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<Credential> {
  available(cryptoProvider);
  const salt = cryptoProvider.getRandomValues(new Uint8Array(16));
  return {
    salt: hex(salt),
    hash: await derive(password, salt, iterations, cryptoProvider),
    iterations,
    algorithm: 'PBKDF2-SHA-256',
  };
}
export async function verifyPassword(
  password: string,
  credential: Credential,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  if (
    credential.algorithm !== 'PBKDF2-SHA-256' ||
    !/^[a-f0-9]{32}$/i.test(credential.salt) ||
    !/^[a-f0-9]{64}$/i.test(credential.hash) ||
    credential.iterations < 100_000 ||
    credential.iterations > 1_000_000
  )
    return false;
  const candidate = await derive(
    password,
    bytes(credential.salt),
    credential.iterations,
    cryptoProvider,
  );
  let difference = 0;
  for (let index = 0; index < candidate.length; index++)
    difference |= candidate.charCodeAt(index) ^ credential.hash.toLowerCase().charCodeAt(index);
  return difference === 0;
}
