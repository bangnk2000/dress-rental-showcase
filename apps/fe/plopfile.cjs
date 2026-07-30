/**
 * Deterministic feature-slice scaffold (docs/spec/init-react/08-ai-agent-first.md §4).
 *   pnpm --filter fe plop feature -- --name <kebab-name>
 * Emits the slice skeleton + locale stubs (vi is the key schema, en mirrors) and
 * registers the i18n namespace in src/types/i18next.d.ts. It does NOT wire the
 * route (that edit is deliberate, in src/app/router.tsx) and does NOT touch
 * feature_list.json (the root harness owns it).
 */
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const ROUTE_TEMPLATE = `import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

/** Scaffolded skeleton — replace the empty state with the real feature UI. */
export function {{pascalCase name}}Route() {
  const { t } = useTranslation('{{kebabCase name}}');
  return (
    <>
      <PageHeader title={t('title')} />
      <EmptyState title={t('title')} description={t('shell.comingSoon')} />
    </>
  );
}
`;

const INDEX_TEMPLATE = `/**
 * PUBLIC SURFACE of the {{kebabCase name}} feature — the only import path for
 * outsiders. Export names are the contract with app/router.tsx.
 */
export { {{pascalCase name}}Route } from './{{kebabCase name}}-route';
`;

const LOCALE_VI = `{
  "title": "{{titleCase name}}",
  "shell": {
    "comingSoon": "Tính năng này đang được xây dựng."
  }
}
`;

const LOCALE_EN = `{
  "title": "{{titleCase name}}",
  "shell": {
    "comingSoon": "This feature is under construction."
  }
}
`;

module.exports = function (plop) {
  plop.setGenerator('feature', {
    description: 'Feature slice: index + route skeleton + vi/en locales + i18n namespace',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'feature name, kebab-case (e.g. availability-check)',
        validate: (value) =>
          KEBAB.test(value) || 'must be kebab-case: lowercase letters/digits and dashes',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/features/{{kebabCase name}}/index.ts',
        template: INDEX_TEMPLATE,
      },
      {
        type: 'add',
        path: 'src/features/{{kebabCase name}}/{{kebabCase name}}-route.tsx',
        template: ROUTE_TEMPLATE,
      },
      {
        type: 'add',
        path: 'public/locales/vi/{{kebabCase name}}.json',
        template: LOCALE_VI,
      },
      {
        type: 'add',
        path: 'public/locales/en/{{kebabCase name}}.json',
        template: LOCALE_EN,
      },
      // Register the namespace type: import line + resources entry (vi-first schema).
      {
        type: 'modify',
        path: 'src/types/i18next.d.ts',
        pattern: /\n\ndeclare module 'i18next'/,
        template:
          "\nimport type {{camelCase name}} from '../../public/locales/vi/{{kebabCase name}}.json';\n\ndeclare module 'i18next'",
      },
      {
        type: 'modify',
        path: 'src/types/i18next.d.ts',
        pattern: /(\n {4}\};\n {2}\}\n\})/,
        template: "\n      '{{kebabCase name}}': typeof {{camelCase name}};$1",
      },
    ],
  });
};
