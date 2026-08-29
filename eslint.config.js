import requireEscapeHtml from './eslint-rules/require-escape-html.js';
import noLocalEscapeHelpers from './eslint-rules/no-local-escape-helpers.js';

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
        plugins: {
            local: {
                rules: {
                    'require-escape-html': requireEscapeHtml,
                    'no-local-escape-helpers': noLocalEscapeHelpers,
                },
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'prefer-const': 'warn',
            'local/require-escape-html': 'error',
        },
    },
    {
        // web/js/utils/escape.js هو المصدر المرجعي الوحيد لهذه الدوال — يُستثنى من
        // قاعدة منع إعادة التعريف المحلي (وإلا لَمنعت تعريفها في مكانها الشرعي).
        files: ['web/**/*.js'],
        ignores: ['web/js/utils/escape.js'],
        rules: {
            'local/no-local-escape-helpers': 'error',
        },
    },
    {
        ignores: ['web/dist/**', 'node_modules/**', 'coverage/**'],
    },
];
