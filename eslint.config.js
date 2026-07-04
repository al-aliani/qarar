/** @type { import("eslint").Linter.Config } */
export default [
    {
        files: ['web/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                Blob: 'readonly',
                FormData: 'readonly',
                AbortController: 'readonly',
                navigator: 'readonly',
                import: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'prefer-const': 'warn',
        },
    },
    {
        ignores: ['web/dist/**', 'node_modules/**', 'coverage/**'],
    },
];
