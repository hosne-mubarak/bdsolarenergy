import type { z } from 'zod';
import type { Runtime } from '../contracts';
import { RepositoryError } from '../errors';
import { storageEnvelopeSchema } from '../../schemas';
import { validateInput } from '../validation';

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

export interface ReadVersionOptions {
  version?: number;
  migrations?: Record<number, (data: unknown) => unknown>;
}

const prefix = 'bdsolarenergy:';
export function createPersistence(storage: StorageLike, runtime: Runtime) {
  const listeners = new Set<() => void>();
  const messages: string[] = [];
  function emit() {
    listeners.forEach((listener) => listener());
  }
  function storageCall<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('storage_unavailable');
    }
  }
  function fullKey(key: string) {
    if (!key || key.startsWith(prefix))
      throw new RepositoryError(
        'validation',
        'Use a nonempty aggregate key without the application prefix.',
      );
    return prefix + key;
  }
  function write<T>(key: string, schema: z.ZodType<T>, data: T, version = 1): T {
    const parsed = validateInput(schema, data);
    const envelope = validateInput(storageEnvelopeSchema(schema), {
      version,
      updatedAt: runtime.now().toISOString(),
      data: parsed,
    });
    storageCall(() => storage.setItem(fullKey(key), JSON.stringify(envelope)));
    emit();
    return structuredClone(parsed);
  }
  function remove(key: string) {
    storageCall(() => storage.removeItem(fullKey(key)));
    emit();
  }
  function read<T>(
    key: string,
    schema: z.ZodType<T>,
    seed: () => T,
    options: ReadVersionOptions = {},
  ): T {
    const raw = storageCall(() => storage.getItem(fullKey(key)));
    if (raw === null) return structuredClone(validateInput(schema, seed()));
    const version = options.version ?? 1;
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw);
    } catch {
      envelope = null;
    }
    // Inspect versions before payload validation, so newer data is never silently discarded.
    if (
      envelope &&
      typeof envelope === 'object' &&
      'version' in envelope &&
      typeof envelope.version === 'number' &&
      envelope.version > version
    ) {
      throw new RepositoryError(
        'conflict',
        'This demo data was saved by a newer version. Reset demo data explicitly or use the newer application.',
      );
    }
    const shape = storageEnvelopeSchema(schema).safeParse(envelope);
    if (shape.success && shape.data.version === version)
      return structuredClone(validateInput(schema, shape.data.data));
    if (
      envelope &&
      typeof envelope === 'object' &&
      'version' in envelope &&
      'data' in envelope &&
      typeof envelope.version === 'number' &&
      Number.isInteger(envelope.version) &&
      envelope.version > 0 &&
      envelope.version < version
    ) {
      let current = envelope.version;
      let data: unknown = envelope.data;
      try {
        while (current < version) {
          const migrate = options.migrations?.[current];
          if (!migrate) throw new Error('Migration unavailable');
          data = migrate(data);
          current++;
        }
        const migrated = schema.safeParse(data);
        if (migrated.success) return write(key, schema, migrated.data, version);
      } catch (error) {
        // Storage failures must propagate, never become a destructive recovery.
        if (error instanceof RepositoryError) throw error;
      }
    }
    remove(key);
    messages.push(
      `Saved ${key} data was invalid or outdated and has been reset. Other demo data was preserved.`,
    );
    emit();
    return structuredClone(validateInput(schema, seed()));
  }
  function reset() {
    const keys = storageCall(() =>
      Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
        (key): key is string => Boolean(key?.startsWith(prefix)),
      ),
    );
    // Each removal can fail; callers must show failure and must not claim a full reset.
    keys.forEach((key) => storageCall(() => storage.removeItem(key)));
    messages.length = 0;
    emit();
  }
  return {
    read,
    write,
    remove,
    reset,
    notices: () => [...messages],
    reportNotice(message: string) {
      messages.push(message);
      emit();
    },
    clearNotices() {
      messages.length = 0;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    externalChange(key: string | null) {
      if (key === null || key.startsWith(prefix)) emit();
    },
  };
}
export type Persistence = ReturnType<typeof createPersistence>;
