/* config-overrides.js */
const {solidityLoader} = require("./config/webpack")
const {override, overrideDevServer} = require("customize-cra")

const allowOutsideImports = () => (config) => {
  // allow importing from outside of app/src folder, ModuleScopePlugin prevents this.
  const scope = config.resolve.plugins.findIndex((o) => o.constructor.name === "ModuleScopePlugin")
  if (scope > -1) {
    config.resolve.plugins.splice(scope, 1)
  }
  return config
}

const solidityHotReloading = (solidityLoader) => (config) => {
  // add Zeppelin Solidity hot reloading support
  // have to insert before last loader, because CRA user 'file-loader' as default one
  config.module.rules.splice(config.module.rules - 2, 0, solidityLoader)
  return config
}

const gnosisSafeIntegration = () => (config) => {
  // Need to allow CORS for gnosis-safe integration locally
  config.headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
  }

  config.proxy = {
    ...(config.proxy || {}),
    "/relay": "http://localhost:4000",
  }

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
    // so we do that in the npm `murmuration-start` command.

    config.proxy = {
      ...(config.proxy || {}),
      // In the murmuration environment, we have the Webpack dev server proxy for the hardhat node
      // (which is run via `npx hardhat node` in the `murmuration-start` npm command). This approach
      // was arrived at after an approach of not colocating the hardhat node and the Webpack dev server
      // in the same environment was determined not to be viable. (See
      // https://github.com/goldfinch-eng/goldfinch-protocol/pull/360#issuecomment-882943366. The issue
      // was in sharing the contracts definitions in `client/config/deployments_dev.json` and in
      // maintaining the chain state held in memory by the hardhat node process.)
      "/_chain": "http://localhost:8545",
    }
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
    gnosisSafeIntegration(),
    murmuration(),
  ),
};
