import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
    // Ignore built outputs and generated files
    {
        ignores: ['out/**', 'dist/**', 'node_modules/**', '*.config.*'],
    },

    // Base JS rules
    js.configs.recommended,

    // TypeScript rules
    ...tseslint.configs.recommended,

    // React + React Hooks rules
    {
        files: ['src/renderer/src/**/*.{ts,tsx}', 'src/preload/**/*.ts'],
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooks,
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            ...reactPlugin.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,

            // React 17+ JSX transform — no need to import React
            'react/react-in-jsx-scope': 'off',
            'react-hooks/set-state-in-effect': 'off',
            'react/prop-types': 'off',

            // TypeScript-specific relaxations
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/no-require-imports': 'error',
            // General
            'no-console': 'off',
        },
    },

    // Main process (Node/Electron) — no React rules
    {
        files: ['src/main/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
        },
    }
)
