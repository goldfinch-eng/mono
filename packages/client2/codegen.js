/* eslint-disable @typescript-eslint/no-var-requires */
// ! IMPORTANT: In case of emergency where our subgraph goes down due to error, this codegen step will fail.
// ! Since this codegen step is part of app builds, deployment and development will fail (the existing app in production should be OK, it uses non-fatal subgraph errors).
// ! The most straightforward solution is to fix the subgraph error, but if you need to develop/deploy the app in the meantime, you can take these temporary countermeasures:
// ! If you only need to make your local dev work:
// ! 1. Change NEXT_PUBLIC_GRAPHQL_URL in .env.local to a working version of the most recent subgraph. This can be localhost if you're running it. Codegen will now work again for local dev
// ! If you need prod deployments to work:
// ! 1. Same as step 1 above
// ! 2. `yarn codegen-introspection` - Now you'll have an up-to-date introspection result at ./lib/graphql/schema.json
// ! 3. Remove `lib/graphql/schema.json` from .gitignore, then change `schema` below to use that local file instead of a remote URL (check the comment below)
// ! 4. Commit the schema.json file and the change to `schema` in this file. Remote builds will now work again because the types are being generated off schema.json
// ! UNDO THE ABOVE STEPS ONCE THE SUBGRAPH IS WORKING AGAIN. schema.json is an auto-generated file and it'll show up in diffs all the time which is annoying

const nextEnv = require("@next/env");
const env = nextEnv.loadEnvConfig(".");

const graphQlApiUrl =
  typeof env.combinedEnv.NEXT_PUBLIC_GRAPHQL_URL !== "undefined"
    ? env.combinedEnv.NEXT_PUBLIC_GRAPHQL_URL
    : env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? "https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch-v2"
    : env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME === "localhost"
    ? "http://localhost:8000/subgraphs/name/goldfinch-subgraph"
    : null;
if (!graphQlApiUrl) {
  throw new Error("Could not determine GraphQL API URL");
}

const cmsApiUrl =
  typeof env.combinedEnv.NEXT_PUBLIC_CMS_GRAPHQL_API_URL !== "undefined"
    ? env.combinedEnv.NEXT_PUBLIC_CMS_GRAPHQL_API_URL
    : env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? "http://cms.goldfinch.finance/api/graphql"
    : env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME === "localhost"
    ? "http://localhost:3010/api/graphql"
    : null;
if (!cmsApiUrl) {
  throw new Error("Could not determine CMS API URL");
}

module.exports = {
  schema: [
    graphQlApiUrl, // ./lib/graphql/schema.json in case of emergency (see above note)
    cmsApiUrl,
    "./lib/graphql/client-only-schema.graphql",
  ],
  documents: [
    "./pages/**/*.tsx",
    "./pages/**/*.ts",
    "./components/**/*.tsx",
    "./lib/pools/**/*.ts",
  ],
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
          Bytes: "string",
          CryptoAmount: "CryptoAmount",
          UsdcAmount: `CryptoAmount<"USDC">`,
          FiduAmount: `CryptoAmount<"FIDU">`,
          GfiAmount: `CryptoAmount<"GFI">`,
          CurveLpAmount: `CryptoAmount<"CURVE_LP">`,
        },
        enumsAsTypes: true,
      },
    },
    "lib/graphql/schema.json": {
      plugins: ["introspection"],
      config: {
        minify: true,
        descriptions: false,
      },
    },
  },
};
