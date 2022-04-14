const nextEnv = require("@next/env");
const env = nextEnv.loadEnvConfig(".");

const schema = env.combinedEnv.NEXT_PUBLIC_GRAPHQL_URL;

module.exports = {
  schema,
  documents: ["./pages/**/*.tsx", "./components/**/*.tsx"],
  generates: {
    "lib/graphql/generated.ts": {
      schema: "./lib/graphql/client-only-schema.graphql",
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
