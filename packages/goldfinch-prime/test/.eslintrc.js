module.exports = {
  extends: "../.eslintrc.js",
  rules: {
    // Disabled to prevent ESLint complaining about Chai assertions
    // (see https://stackoverflow.com/q/45079454).
    "@typescript-eslint/no-unused-expressions": "off",
  },
}
