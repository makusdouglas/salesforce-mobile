const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

const supabaseRestriction = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@supabase/*'],
            message:
              'Direct Supabase imports are forbidden outside src/data/. Constitution R1 — WatermelonDB is the single client data layer.',
          },
        ],
      },
    ],
  },
};

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      'web-build/',
      'assets/',
      'ios/',
      'android/',
      // Supabase Edge Functions run on Deno and import via https:// URLs.
      // ESLint's Node resolver can't follow those; lint inside the
      // Supabase CLI / deno lint instead.
      'supabase/functions/',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ...supabaseRestriction,
  },
  {
    files: ['src/data/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
