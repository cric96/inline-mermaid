import {builtinRules} from 'eslint/use-at-your-own-risk';
import google from 'eslint-config-google';
import globals from 'globals';

// eslint-config-google still references rules removed from ESLint
const googleRules = Object.fromEntries(
    Object.entries(google.rules).filter(([rule]) => builtinRules.has(rule)),
);

export default [
  {
    ignores: ['exampleSite/'],
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...googleRules,
      // JSONPath is meant to be called without new as well
      'new-cap': ['error', {capIsNewExceptions: ['JSONPath']}],
    },
  },
];
