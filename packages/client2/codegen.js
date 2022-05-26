module.exports = {
  schema: [
    "./lib/graphql/schema.json",
    "./lib/graphql/client-only-schema.graphql",
  ],
  documents: ["./pages/**/*.tsx", "./components/**/*.tsx"],
  generates: {
    "lib/graphql/generated.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-react-apollo",
      ],
      config: {
        withHooks: true,
        scalars: {
          BigInt: "TheGraph_BigInt",
          BigDecimal: "TheGraph_BigDecimal",
        },
      },
    },
  },
};
