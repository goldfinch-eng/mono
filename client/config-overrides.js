/* config-overrides.js */
const { solidityLoader } = require('./config/webpack');
const { override, overrideDevServer } = require('customize-cra');
const { addReactRefresh } = require('customize-cra-react-refresh');

const allowOutsideImports = () => config => {
  // allow importing from outside of app/src folder, ModuleScopePlugin prevents this.
  const scope = config.resolve.plugins.findIndex(o => o.constructor.name === 'ModuleScopePlugin');
  if (scope > -1) {
    config.resolve.plugins.splice(scope, 1);
  }
  return config;
};

const solidityHotReloading = solidityLoader => config => {
  // add Zeppelin Solidity hot reloading support
  // have to insert before last loader, because CRA user 'file-loader' as default one
  config.module.rules.splice(config.module.rules - 2, 0, solidityLoader);
  return config;
};

const gnosisSafeIntegration = () => config => {
  // Need to allow CORS for gnosis-safe integration locally
  config.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
  };

  config.proxy = {
    '/relay': 'http://localhost:4000',
  };

  return config;
};

// prettier-ignore
module.exports = {
  webpack: override(
    allowOutsideImports(),
    solidityHotReloading(solidityLoader),
    addReactRefresh()
  ),
  devServer: overrideDevServer(
    gnosisSafeIntegration()
  ),
};
