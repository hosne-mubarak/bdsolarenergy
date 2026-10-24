import type { Runtime } from '../contracts';
import { RepositoryError } from '../errors';
import { createPersistence } from './store';

/** Access the native stores at runtime, keeping denied-storage errors recoverable. */
export function createBrowserPersistence(
  runtime: Runtime,
  kind: 'localStorage' | 'sessionStorage' = 'localStorage',
) {
  let native: Storage;
  try {
    native = window[kind];
  } catch {
    throw new RepositoryError('storage_unavailable');
  }
  const store = createPersistence(native, runtime);
  const listener = (event: StorageEvent) => {
    if (event.storageArea === native) store.externalChange(event.key);
  };
  window.addEventListener('storage', listener);
  return { store, dispose: () => window.removeEventListener('storage', listener) };
}

/** Lazy access lets public catalogue browsing continue when storage is denied. */
export function browserStorage(kind: 'localStorage' | 'sessionStorage' = 'localStorage') {
  return {
    get length() {
      return window[kind].length;
    },
    key: (index: number) => window[kind].key(index),
    getItem: (key: string) => window[kind].getItem(key),
    setItem: (key: string, value: string) => window[kind].setItem(key, value),
    removeItem: (key: string) => window[kind].removeItem(key),
  };
}
