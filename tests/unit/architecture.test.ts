/// <reference types="node" />
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });
async function boundaryMessages(code: string, filePath = 'src/features/account/BoundaryProbe.tsx') {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((message) =>
    ['architecture/ui-boundaries', 'no-restricted-globals'].includes(message.ruleId ?? ''),
  );
}

describe('UI architecture enforcement', () => {
  it('allows repository contracts, safe error mappings, hooks and query-client reads', async () => {
    expect(
      await boundaryMessages(`
      import type { ProfileInput } from '../../types';
      import { RepositoryError } from '../../services/errors';
      export function Probe(input: ProfileInput) {
        if (!input.displayName) throw new RepositoryError('validation');
        return input.displayName;
      }
    `),
    ).toEqual([]);
    expect(
      await boundaryMessages(`
      import { useQuery } from '@tanstack/react-query';
      export function useProfile() { return useQuery({queryKey: ['profile'], queryFn: () => repository.getProfile()}); }
    `),
    ).toEqual([]);
  });

  it.each([
    "import records from '../../data/products.json';",
    "export { default } from '../../data/products.json';",
    "const data = import('../../data/products.json');",
    "const data = require('../../data/products.json');",
    "const records = import.meta.glob('../../data/*.json');",
    "const records = import('../../data/' + filename);",
  ])('blocks fixture loading in UI: %s', async (code) => {
    expect(await boundaryMessages(code)).not.toHaveLength(0);
  });

  it.each([
    "import { createJsonReadRepositories } from '../../services/json/read-repositories';",
    "import { createPersistence } from '../../services/persistence/store';",
    "import { createShoppingServices } from '../../services/shopping';",
    "import { createPublicRepositories } from '../../services/public';",
    "export * from '../../services/json/auth';",
  ])('blocks concrete infrastructure in a feature: %s', async (code) => {
    expect(await boundaryMessages(code)).not.toHaveLength(0);
  });

  it.each([
    "fetch('/products');",
    "window.fetch('/products');",
    "globalThis['fetch']('/products');",
    "window?.fetch?.('/products');",
    "const request = window.fetch; request('/products');",
    "const { fetch: request } = window; request('/products');",
    "localStorage.getItem('cart');",
    "window['localStorage'].getItem('cart');",
    "window[`localStorage`].getItem('cart');",
    "globalThis['fe' + 'tch']('/products');",
    'globalThis.sessionStorage.clear();',
    'const { sessionStorage: storage } = globalThis; storage.clear();',
    'new XMLHttpRequest();',
  ])('blocks direct HTTP/storage access: %s', async (code) => {
    expect(await boundaryMessages(code)).not.toHaveLength(0);
  });

  it('keeps query methods and image fetch priority valid', async () => {
    expect(
      await boundaryMessages(`
        export function Preview() {
          const query = { refetch: () => undefined };
          query.refetch();
          return <img src="/sample.svg" alt="Sample panel" fetchPriority="high" />;
        }
        export async function read(client: { fetchQuery: () => Promise<string> }) {
          return client.fetchQuery();
        }
      `),
    ).toEqual([]);
  });

  it('applies the boundary to both application entry files', async () => {
    for (const filePath of ['src/App.tsx', 'src/main.tsx']) {
      expect(await boundaryMessages('window.localStorage.clear();', filePath)).not.toHaveLength(0);
      expect(
        await boundaryMessages(
          "import { createShoppingServices } from './services/shopping';",
          filePath,
        ),
      ).not.toHaveLength(0);
    }
  });

  it('limits constructor exceptions to the two actual composition providers', async () => {
    const shopping = "import { createShoppingServices } from '../../services/shopping';";
    const publicRepositories = "import { createPublicRepositories } from '../../services/public';";
    expect(await boundaryMessages(shopping, 'src/app/providers/ShoppingProvider.tsx')).toEqual([]);
    expect(
      await boundaryMessages(publicRepositories, 'src/app/providers/RepositoryProvider.tsx'),
    ).toEqual([]);
    expect(await boundaryMessages(shopping, 'src/app/providers/AuthProvider.tsx')).not.toHaveLength(
      0,
    );
    expect(
      await boundaryMessages(publicRepositories, 'src/app/providers/ShoppingProvider.tsx'),
    ).not.toHaveLength(0);
    expect(
      await boundaryMessages(
        "import type { ShoppingServices } from '../../services/shopping';",
        'src/app/providers/shopping-context.ts',
      ),
    ).toEqual([]);
  });

  it('allows deterministic test setup and infrastructure adapters to exercise raw browser faults', async () => {
    const code =
      "import data from '../../data/products.json'; window.localStorage.clear(); window.fetch('/probe');";
    expect(await boundaryMessages(code, 'src/features/account/account.test.tsx')).toEqual([]);
    expect(await boundaryMessages(code, 'src/services/json/BoundaryProbe.ts')).toEqual([]);
  });
});
