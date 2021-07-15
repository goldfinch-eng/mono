/* config-overrides.js */
const {solidityLoader} = require("./config/webpack")
const {override, overrideDevServer} = require("customize-cra")
const {addReactRefresh} = require("customize-cra-react-refresh")

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

/**
 * For the murmuration deployment on Google App Engine, we want the Webpack dev server
 * to serve at hostname 0.0.0.0, so that it is accessible outside the Docker
 * container in which it runs (cf. https://stackoverflow.com/a/39638515).
 */
const murmuration = () => config => {
  if (process.env.MURMURATION === "yes") {
    config.host = "0.0.0.0"

    // Note that we also need the dev server to listen on port 8080,
    // because that is the port App Engine requires (cf.
    // https://cloud.google.com/appengine/docs/flexible/custom-runtimes/build#listening_to_port_8080),
    // but react-app-rewired only supports specifying the port via an environment variable (cf.
    // https://github.com/timarney/react-app-rewired/issues/436),
    // so that's what we do in the npm `start-murmuration` command.
  }
  return config
}

// prettier-ignore
module.exports = {
  webpack: override(
    allowOutsideImports(),
    solidityHotReloading(solidityLoader),
    addReactRefresh()
  ),
  devServer: overrideDevServer(
    gnosisSafeIntegration(),
    murmuration(),
  ),
};
