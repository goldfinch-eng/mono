import { BN } from 'bn.js';
import _ from "lodash";
import * as ProtocolConfig from '../../config/deployments.json';

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

export {
  sendFromUser,
  mapNetworkToID,
  transformedConfig,
}