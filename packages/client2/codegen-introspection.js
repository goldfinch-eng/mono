const nextEnv = require("@next/env");
const env = nextEnv.loadEnvConfig(".");

module.exports = {
  schema: [
    env.combinedEnv.NEXT_PUBLIC_GRAPHQL_URL,
    "./lib/graphql/client-only-schema.graphql",
  ],
  documents: ["./pages/**/*.tsx", "./components/**/*.tsx"],
  generates: {
    "lib/graphql/schema.json": {
      plugins: ["introspection"],
      config: {
        minify: true,
        descriptions: false,
      },
    },
  },
};
