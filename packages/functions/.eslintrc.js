module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/src/graphql/generated/*", // Ignore generated graphql files.
  ],
  plugins: ["@typescript-eslint", "import", "prettier"],
  rules: {
    "prettier/prettier": "error",
    indent: ["error", 2, {SwitchCase: 1}],
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "double"],
    semi: ["error", "never"],
    "import/no-unresolved": [
      // https://github.com/firebase/firebase-admin-node/discussions/1359
      "error",
      {
        ignore: ["^firebase-functions/.+"],
      },
    ],
  },
}
