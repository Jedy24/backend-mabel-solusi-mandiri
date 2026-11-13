import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
    { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
    { rules: { curly: ['error', 'all'] } }
];
