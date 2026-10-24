/** A synchronous UI fence prevents session notifications outrunning mutation observers. */
export function createAuthTransition() {
  let pending = 0;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    begin: () => {
      pending++;
      notify();
    },
    end: () => {
      pending = Math.max(0, pending - 1);
      notify();
    },
    getSnapshot: () => pending > 0,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
