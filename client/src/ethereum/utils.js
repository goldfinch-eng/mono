import { BN } from 'bn.js';
import _ from "lodash";
import * as ProtocolConfig from '../../config/deployments.json';

const USDC_ADDRESSES = {
  "ropsten": "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
}
const decimalPlaces = 6;
const decimals = new BN(String(10 ** decimalPlaces));

function sendFromUser(unsentTransaction, userAddress) {
  return unsentTransaction.send({
    from: userAddress,
    gasPrice: new BN('20000000000'),
    gas: new BN('6721975')
  });
}

const mapNetworkToID = {
  "ropsten": "ropsten",
  "private": "localhost"
}

function transformedConfig() {
  return _.reduce(ProtocolConfig, (result, item) => {
    _.toArray(item).forEach((networkConfig) => {
      return _.merge(result, networkConfig);
    });
    return result;
  }, {});
}

function fetchDataFromAttributes(web3Obj, attributes) {
  const result = {};
  if (!web3Obj) {
    return Promise.resolve(result);
  }
  var promises = attributes.map((methodInfo) => { return web3Obj.methods[methodInfo.method](...(methodInfo.args || [])).call() });
  return Promise.all(promises).then((results) => {
    attributes.forEach((methodInfo, index) => {
      result[methodInfo.name || methodInfo.method] = results[index];
    });
    return result;
  });
}

export {
  sendFromUser,
  mapNetworkToID,
  transformedConfig,
  fetchDataFromAttributes,
  decimalPlaces,
  decimals,
  USDC_ADDRESSES,
}