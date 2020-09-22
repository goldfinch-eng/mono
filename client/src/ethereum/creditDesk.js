import web3 from '../web3';
import * as CreditDeskContract from '../../../artifacts/CreditDesk.json';
import { transformedConfig, mapNetworkToID } from './utils';

function getCreditDesk(networkName) {
  const networkId = mapNetworkToID[networkName];
  const creditDeskAddress = transformedConfig()[networkId].contracts.CreditDesk.address;
  console.log('Credit desk address is:', creditDeskAddress);
  const creditDesk = new web3.eth.Contract(CreditDeskContract.abi, creditDeskAddress);
  return creditDesk;
}

export { getCreditDesk };
