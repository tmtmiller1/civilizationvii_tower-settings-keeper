// ESLint flat config for development, with the same limits the other Tower mods use. Not shipped.
export default [
  {
    files: ["ui/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { window: "readonly", console: "readonly", localStorage: "readonly", globalThis: "readonly", Storage: "readonly", Locale: "readonly", document: "readonly" }
    },
    rules: {
      complexity: ["error", 10],
      "max-statements": ["error", 18],
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true }],
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
      "max-len": ["error", { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true }],
      "max-params": ["error", 5],
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }]
    }
  }
];
