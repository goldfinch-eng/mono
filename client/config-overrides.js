/* config-overrides.js */
const webpack = require("webpack")
const {solidityLoader} = require("./config/webpack")
const {override, overrideDevServer} = require("customize-cra")
const {addReactRefresh} = require("customize-cra-react-refresh")
const childProcess = require("child_process")

const allowOutsideImports = () => config => {
  // allow importing from outside of app/src folder, ModuleScopePlugin prevents this.
  const scope = config.resolve.plugins.findIndex(o => o.constructor.name === "ModuleScopePlugin")
  if (scope > -1) {
    config.resolve.plugins.splice(scope, 1)
  }
  return config
}

const solidityHotReloading = solidityLoader => config => {
  // add Zeppelin Solidity hot reloading support
  // have to insert before last loader, because CRA user 'file-loader' as default one
  config.module.rules.splice(config.module.rules - 2, 0, solidityLoader)
  return config
}

const gnosisSafeIntegration = () => config => {
  // Need to allow CORS for gnosis-safe integration locally
  config.headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
  }

  config.proxy = {
    "/relay": "http://localhost:4000",
  }

  return config
}

const injectCommitId = () => config => {
  const commitId = childProcess.execSync("git rev-parse HEAD").toString("utf8")

  config.plugins = (config.plugins || []).concat(
    new webpack.DefinePlugin({
      "process.env.REACT_APP_COMMIT_ID": JSON.stringify(commitId),
    }),
  )
  return config
}

// prettier-ignore
module.exports = {
  webpack: override(
    allowOutsideImports(),
    solidityHotReloading(solidityLoader),
    addReactRefresh(),
    injectCommitId()
  ),
  devServer: overrideDevServer(
    gnosisSafeIntegration()
  ),
};
