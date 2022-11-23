module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es6: true,
    mocha: true,
  },
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  parserOptions: {
    ecmaVersion: 11,
    sourceType: "module",
  },
  plugins: ["mocha-no-only", "@typescript-eslint", "prettier", "chai-friendly"],
  globals: {
    process: "readonly",
  },
  ignorePatterns: ["cache", "artifacts", "typechain", "dist", "lib/openzeppelin-contracts"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      extends: ["eslint:recommended", "plugin:prettier/recommended", "plugin:@typescript-eslint/recommended"],
      parserOptions: {
        project: "tsconfig.json",
        sourceType: "module",
      },
      rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/ban-types": "off",

        // TypeScript's `noFallthroughCasesInSwitch` option is more robust (#6906)
        "default-case": "off",
        // 'tsc' already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/291)
        "no-dupe-class-members": "off",
        // 'tsc' already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/477)
        "no-undef": "off",

        // Add TypeScript specific rules (and turn off ESLint equivalents)
        "@typescript-eslint/consistent-type-assertions": "warn",
        "no-array-constructor": "off",
        "@typescript-eslint/no-array-constructor": "warn",
        "no-redeclare": "off",
        "@typescript-eslint/no-redeclare": "warn",
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": [
          "warn",
          {
            functions: false,
            classes: false,
            variables: false,
            typedefs: false,
          },
        ],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            args: "none",
            ignoreRestSiblings: true,
          },
        ],
        "no-useless-constructor": "off",
        "@typescript-eslint/no-useless-constructor": "warn",
      },
    },
  ],
  rules: {
    indent: ["error", 2],
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "double"],
    semi: ["error", "never"],
    "object-curly-spacing": ["error", "never"],
    "mocha-no-only/mocha-no-only": ["error"],
    "no-unused-expressions": "off",
    "chai-friendly/no-unused-expressions": "error",
  },
}
