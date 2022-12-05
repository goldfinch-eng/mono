module.exports = {
  printWidth: 120,
  bracketSpacing: false,
  semi: false,
  overrides: [
    {
      files: "*.sol",
      options: {
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        explicitTypes: "always",
      },
    },
  ],
}
