import web3 from '../web3';
import * as CreditDeskContract from '../../../artifacts/CreditDesk.json';
import { transformedConfig, mapNetworkToID } from './utils';

function getCreditDesk(networkName) {
  const networkId = mapNetworkToID[networkName];
  const creditDesk = new web3.eth.Contract(CreditDeskContract.abi, transformedConfig()[networkId].contracts.CreditDesk.address);
  return creditDesk;
}

export {
  getCreditDesk
}