/* config-overrides.js */
const { solidityLoader } = require('./config/webpack');

module.exports = {
  webpack: function override(config, env) {
    //do stuff with the webpack config...

    // allow importing from outside of app/src folder, ModuleScopePlugin prevents this.
    const scope = config.resolve.plugins.findIndex(o => o.constructor.name === 'ModuleScopePlugin');
    if (scope > -1) {
      config.resolve.plugins.splice(scope, 1);
    }

    // add Zeppelin Solidity hot reloading support
    // have to insert before last loader, because CRA user 'file-loader' as default one
    config.module.rules.splice(config.module.rules - 2, 0, solidityLoader);

    return config;
  },
  devServer: function(configFunction) {
    // Return the replacement function for create-react-app to use to generate the Webpack
    // Development Server config. "configFunction" is the function that would normally have
    // been used to generate the Webpack Development server config - you can use it to create
    // a starting configuration to then modify instead of having to create a config from scratch.
    return function(proxy, allowedHost) {
      // Create the default config by calling configFunction with the proxy/allowedHost parameters
      const config = configFunction(proxy, allowedHost);

      // Need to allow CORS for gnosis-safe integration locally
      config.headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
      };

      config.proxy = {
        '/relay': 'http://localhost:4000',
      };

      // Return your customised Webpack Development Server config.
      return config;
    };
  },
};
