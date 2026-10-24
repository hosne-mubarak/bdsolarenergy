import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// This is a maintainability guard, not a security boundary or a module resolver.
const rawAccess = new Set(['fetch', 'localStorage', 'sessionStorage']);
const compositionModules = new Map([
  ['src/app/providers/ShoppingProvider.tsx', 'shopping'],
  ['src/app/providers/RepositoryProvider.tsx', 'public'],
]);
function staticString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left);
    const right = staticString(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}
function staticProperty(node) {
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
  return node.computed ? staticString(node.property) : undefined;
}
const uiBoundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      data: 'Read fixture and JSON data through repository contracts.',
      adapter: 'Concrete adapters and persistence belong behind application composition.',
      raw: 'Raw HTTP and browser storage access belongs in infrastructure adapters.',
      dynamic: 'Use a static module specifier so UI data boundaries remain reviewable.',
    },
  },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    function moduleAccess(node, source, typeOnly = false) {
      if (typeof source !== 'string') {
        context.report({ node, messageId: 'dynamic' });
        return;
      }
      if (/(?:^|\/)data(?:\/|$)/.test(source) || /\.json(?:[?#].*)?$/.test(source)) {
        context.report({ node, messageId: 'data' });
        return;
      }
      const concrete = /(?:^|\/)services\/(?:json|persistence)(?:\/|$)/.test(source);
      const factory = source.match(
        /(?:^|\/)services\/(shopping|public|container|runtime)(?:\.[cm]?[jt]sx?)?$/,
      );
      const composition = [...compositionModules].some(
        ([file, module]) => filename.endsWith(`/${file}`) && factory?.[1] === module,
      );
      if (concrete || (factory && !typeOnly && !composition))
        context.report({ node, messageId: 'adapter' });
    }
    return {
      ImportDeclaration(node) {
        const typeOnly =
          node.importKind === 'type' ||
          (node.specifiers.length > 0 &&
            node.specifiers.every((entry) => entry.importKind === 'type'));
        moduleAccess(node, node.source.value, typeOnly);
      },
      ExportNamedDeclaration(node) {
        if (node.source) moduleAccess(node, node.source.value, node.exportKind === 'type');
      },
      ExportAllDeclaration(node) {
        moduleAccess(node, node.source.value, node.exportKind === 'type');
      },
      ImportExpression(node) {
        moduleAccess(node, staticString(node.source));
      },
      CallExpression(node) {
        const requireCall = node.callee.type === 'Identifier' && node.callee.name === 'require';
        const globCall =
          node.callee.type === 'MemberExpression' &&
          ['glob', 'globEager'].includes(staticProperty(node.callee)) &&
          node.callee.object.type === 'MetaProperty';
        if (requireCall || globCall) {
          const source = node.arguments[0];
          moduleAccess(node, staticString(source));
        }
      },
      MemberExpression(node) {
        // Also catches optional chains, aliases, and window['localStorage'] forms.
        if (rawAccess.has(staticProperty(node))) context.report({ node, messageId: 'raw' });
      },
      ObjectPattern(node) {
        for (const property of node.properties) {
          if (property.type !== 'Property') continue;
          const name =
            property.key.type === 'Identifier' ? property.key.name : staticString(property.key);
          if (rawAccess.has(name)) context.report({ node: property, messageId: 'raw' });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.cache/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: [
      'src/App.tsx',
      'src/main.tsx',
      'src/components/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    plugins: { architecture: { rules: { 'ui-boundaries': uiBoundaries } } },
    rules: {
      'architecture/ui-boundaries': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'HTTP belongs in infrastructure adapters.' },
        { name: 'localStorage', message: 'Use the persistence adapter.' },
        { name: 'sessionStorage', message: 'Use the persistence adapter.' },
        { name: 'XMLHttpRequest', message: 'HTTP belongs in infrastructure adapters.' },
      ],
    },
  },
);
