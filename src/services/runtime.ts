import type { Runtime } from './contracts';

export const browserRuntime: Runtime = {
  now: () => new Date(),
  id: (prefix = 'demo') => `${prefix}-${crypto.randomUUID()}`,
};
