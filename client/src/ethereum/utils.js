import BigNumber from 'bignumber.js';
import { BN } from 'bn.js';
import _ from 'lodash';
import web3 from '../web3';

const decimalPlaces = 6;
const decimals = new BN(String(10 ** decimalPlaces));
const USDC_DECIMALS = decimals;
const CONFIRMATION_THRESHOLD = 6;
const ETHDecimals = new BN(String(1e18));
const INTEREST_DECIMALS = new BN(String(1e8));
const BLOCKS_PER_DAY = 5760;
const BLOCKS_PER_YEAR = BLOCKS_PER_DAY * 365;
const MAX_UINT = new BN('115792089237316195423570985008687907853269984665640564039457584007913129639935');
const MAINNET = 'mainnet';
const ROPSTEN = 'ropsten';
const RINKEBY = 'rinkeby';
const LOCAL = 'localhost';
const MAINNET_LAUNCH_BLOCK = '11370658';
const USDC_ADDRESSES = {
  [ROPSTEN]: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
  [MAINNET]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
};

const FORWARDER_ADDRESSES = {
  4: '0x956868751Cc565507B3B58E53a6f9f41B56bed74',
  1: '0xa530F85085C6FE2f866E7FdB716849714a89f4CD',
};

const ONE_INCH_ADDRESSES = {
  localhost: '0xc586bef4a0992c495cf22e1aeee4e446cecdee0e',
  mainnet: '0xc586bef4a0992c495cf22e1aeee4e446cecdee0e',
};

// Only keep entries for supported networks
// (ie. where we deployed the latest contracts)
const mapNetworkToID = {
  main: MAINNET,
  ropsten: ROPSTEN,
  private: 'localhost',
  rinkeby: RINKEBY,
};

const SUPPORTED_NETWORKS = {
  [MAINNET]: true,
  [LOCAL]: true,
  [RINKEBY]: true,
};

let config;
async function getDeployments(networkId) {
  if (config) {
    return Promise.resolve(config[networkId]);
  }
  const deploymentFileNameSuffix = process.env.NODE_ENV === 'development' ? '_dev' : '';
  return import(`../../config/deployments${deploymentFileNameSuffix}.json`)
    .then(result => {
      config = transformedConfig(result);
      return config[networkId];
    })
    .catch(console.error);
}

function transformedConfig(config) {
  return _.reduce(
    config,
    (result, item) => {
      _.toArray(item).forEach(networkConfig => {
        return _.merge(result, networkConfig);
      });
      return result;
    },
    {},
  );
}

function getFromBlock(chain) {
  if (chain === 'mainnet') {
    return MAINNET_LAUNCH_BLOCK;
  } else {
    return 'earliest';
  }
}

function fetchDataFromAttributes(web3Obj, attributes, { bigNumber } = {}) {
  const result = {};
  if (!web3Obj) {
    return Promise.resolve(result);
  }
  var promises = attributes.map(methodInfo => {
    return web3Obj.methods[methodInfo.method](...(methodInfo.args || [])).call();
  });
  return Promise.all(promises)
    .then(results => {
      attributes.forEach((methodInfo, index) => {
        if (bigNumber) {
          result[methodInfo.name || methodInfo.method] = new BigNumber(results[index]);
        } else {
          result[methodInfo.name || methodInfo.method] = results[index];
        }
      });
      return result;
    })
    .catch(e => {
      throw new Error(e);
    });
}

export {
  getDeployments,
  mapNetworkToID,
  transformedConfig,
  fetchDataFromAttributes,
  decimalPlaces,
  decimals,
  ETHDecimals,
  USDC_ADDRESSES,
  FORWARDER_ADDRESSES,
  MAX_UINT,
  USDC_DECIMALS,
  INTEREST_DECIMALS,
  BLOCKS_PER_YEAR,
  BLOCKS_PER_DAY,
  CONFIRMATION_THRESHOLD,
  SUPPORTED_NETWORKS,
  ONE_INCH_ADDRESSES,
  getFromBlock,
};
