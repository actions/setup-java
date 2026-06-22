import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jestPlugin from 'eslint-plugin-jest';
import nodePlugin from 'eslint-plugin-n';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'lib/',
      'node_modules/',
      'coverage/',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.d.ts'
    ]
  },
  {
    files: ['src/**/*.ts', '__tests__/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      jestPlugin.configs['flat/recommended'],
      eslintConfigPrettier
    ],
    plugins: {
      n: nodePlugin
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description'
        }
      ],
      'no-console': 'error',
      yoda: 'error',
      'prefer-const': [
        'error',
        {
          destructuring: 'all'
        }
      ],
      'no-control-regex': 'off',
      'no-constant-condition': ['error', {checkLoops: false}],
      // ESLint 10's recommended set adds `preserve-caught-error`, which the
      // previous ESLint 8 recommended config did not enable. Keep it off to
      // preserve the prior lint behavior; adopting it would require attaching
      // an Error `cause` (ES2022) and is out of scope for this upgrade.
      'preserve-caught-error': 'off',
      'n/no-extraneous-import': 'error'
    }
  },
  {
    files: ['**/*{test,spec}.ts'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/no-conditional-expect': 'off',
      'no-console': 'off'
    }
  }
);
