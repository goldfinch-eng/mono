/* config-overrides.js */
const path = require("path")
const {solidityLoader} = require("./config/webpack")
const {override, overrideDevServer} = require("customize-cra")

const findWebpackPlugin = (webpackConfig, pluginName) =>
  webpackConfig.resolve.plugins.find(({constructor}) => constructor && constructor.name === pluginName)

const genEnableImportsFromExternalPaths = (ruleStringPredicate) => (webpackConfig, newIncludePaths) => {
  const oneOfRule = webpackConfig.module.rules.find((rule) => rule.oneOf)
  if (oneOfRule) {
    const tsRule = oneOfRule.oneOf.find((rule) => {
      const ruleString = rule.test ? rule.test.toString() : undefined
      return ruleStringPredicate(ruleString)
    })
    if (tsRule) {
      // Include `newIncludePaths` in the "include" specification for `tsRule`, so that whatever loader(s)
      // are applied for files matching the rule are also applied to the `newIncludePaths` files. This
      // application of the loader(s) is necessary, for example, in the case of Typescript files
      // specified in `newIncludePaths`: it transpiles those files, like the Typescript files in the
      // `src` dir get transpiled.
      tsRule.include = Array.isArray(tsRule.include)
        ? [...tsRule.include, ...newIncludePaths]
        : [tsRule.include, ...newIncludePaths]
    }
  }
}

const enableJsonImportsFromExternalPaths = genEnableImportsFromExternalPaths(
  (ruleString) => ruleString && ruleString.includes("json")
)

const enableTypescriptImportsFromExternalPaths = genEnableImportsFromExternalPaths(
  (ruleString) => ruleString && (ruleString.includes("ts") || ruleString.includes("tsx"))
)

const addPathsToModuleScopePlugin = (webpackConfig, paths) => {
  const moduleScopePlugin = findWebpackPlugin(webpackConfig, "ModuleScopePlugin")
  if (!moduleScopePlugin) {
    throw new Error("Expected to find plugin 'ModuleScopePlugin', but didn't.")
  }
  moduleScopePlugin.appSrcs = [...moduleScopePlugin.appSrcs, ...paths]
}

const allowOutsideImports = () => (config) => {
  // Allow imports from above the `src` dir, which the ModuleScopePlugin otherwise prevents.
  // Cf. https://stackoverflow.com/a/68017931. Allow-listing specific paths to allow to be
  // imported seems preferable to disabling the ModuleScopePlugin altogether, so that Webpack
  // can't arbitrarily reach anywhere in the repo.

  const jsonPaths = [
    path.resolve(__dirname, "../../packages/client/abi/Creditline.json"),
    path.resolve(__dirname, "../../packages/client/abi/ERC20Permit.json"),
    path.resolve(__dirname, "../../packages/client/abi/OneSplit.json"),
    path.resolve(__dirname, "../../packages/pools/metadata/mainnet.json"),
    path.resolve(__dirname, "../../packages/autotasks/unique-identity-signer/USAccreditedIndividuals.json"),
    path.resolve(__dirname, "../../packages/autotasks/unique-identity-signer/USAccreditedEntities.json"),
    path.resolve(__dirname, "../../packages/autotasks/unique-identity-signer/NonUSEntities.json"),
  ]
  const tsPaths = [
    path.resolve(__dirname, "../../packages/protocol/blockchain_scripts/configKeys"),
    path.resolve(__dirname, "../../packages/protocol/blockchain_scripts/merkle/merkleDistributor/types.ts"),
    path.resolve(__dirname, "../../packages/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types.ts"),
    path.resolve(__dirname, "../../packages/utils/src/type.ts"),
    path.resolve(__dirname, "../../packages/autotasks/unique-identity-signer/utils.ts"),
  ]
  const paths = jsonPaths.concat(tsPaths)

  enableJsonImportsFromExternalPaths(config, jsonPaths)
  enableTypescriptImportsFromExternalPaths(config, tsPaths)
  addPathsToModuleScopePlugin(config, paths)

  return config
}

const solidityHotReloading = (solidityLoader) => (config) => {
  // add Zeppelin Solidity hot reloading support
  // have to insert before last loader, because CRA user 'file-loader' as default one
  config.module.rules.splice(config.module.rules - 2, 0, solidityLoader)
  return config
}

const murmuration = () => (config) => {
  if (process.env.MURMURATION === "yes") {
    // Running on Compute Engine, we want the Webpack dev server to serve at hostname
    // 0.0.0.0, so that it is accessible outside the Docker container in which it
    // runs (cf. https://stackoverflow.com/a/39638515).
    config.host = "0.0.0.0"

    // Note that we also need the dev server to listen on port 80,
    // because that is the port we have configured Compute Engine to use,
    // but react-app-rewired only supports specifying the port via an environment variable (cf.
    // https://github.com/timarney/react-app-rewired/issues/436),
    // so we do that in the npm `start:murmuration` command.

    config.proxy = {
      ...(config.proxy || {}),
      // In the murmuration environment, we have the Webpack dev server proxy for the hardhat node
      // (which is run via `npx hardhat node` in the `start:murmuration` npm command). This approach
      // was arrived at after an approach of not colocating the hardhat node and the Webpack dev server
      // in the same environment was determined not to be viable. (See
      // https://github.com/goldfinch-eng/goldfinch-protocol/pull/360#issuecomment-882943366. The issue
      // was in sharing the contracts definitions in `packages/protocol/deployments/all_dev.json` and in
      // maintaining the chain state held in memory by the hardhat node process.)
      "/_chain": "http://localhost:8545",

      // Proxy for cloud functions running locally.
      "/_gcloudfunctions": {
        target: "http://localhost:5001/goldfinch-frontends-dev/us-central1",
        pathRewrite: {
          // Rewrite the path of the proxied request, to drop the `/_gcloudfunctions` path segment, as
          // that segment would otherwise cause the request to fail to match the paths of the cloud functions.
          "^/_gcloudfunctions": "",
        },
        onProxyReq: (proxyReq, req, res) => {
          // Because the request to `/_gcloudfunctions` is not cross-origin (i.e. whereas a request to
          // e.g. `https://us-central1-goldfinch-frontends-dev.cloudfunctions.net` is cross-origin), we expect
          // the `origin` header not to have been set by the user's browswer, and so we need to add that header
          // ourselves, so that the cloud functions can infer from it which blockchain they should use.
          if (req.headers.origin) {
            console.warn(`Expected \`origin\` header not to be defined, but it was: ${req.headers.origin}`)
          } else {
            proxyReq.setHeader("origin", "https://murmuration.goldfinch.finance")
          }
        },
      },
    }
  }
  return config
}

// https://webpack.js.org/configuration/dev-server/#devserverproxy
// Proxy URLs for separate API backend development server and to send API requests to the same domain
const localRelayer = () => (config) => {
  config.proxy = {
    ...(config.proxy || {}),
    "/relay": "http://localhost:4000",
    "/setupForTesting": "http://localhost:4000",
    "/fundWithWhales": "http://localhost:4000",
    "/advanceTimeOneDay": "http://localhost:4000",
    "/advanceTimeThirtyDays": "http://localhost:4000",
    "/kycStatus": "http://localhost:4000",
    "/uniqueIdentitySigner": "http://localhost:4000",
    "/lockTranchedPool": "http://localhost:4000",
  }
  return config
}

// prettier-ignore
module.exports = {
  webpack: override(
    allowOutsideImports(),
    solidityHotReloading(solidityLoader),
  ),
  devServer: overrideDevServer(
    localRelayer(),
    murmuration(),
  ),
};
