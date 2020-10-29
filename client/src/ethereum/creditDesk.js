import web3 from '../web3';
import { getDeployments, mapNetworkToID } from './utils';

async function getCreditDesk(networkName) {
  const networkId = mapNetworkToID[networkName];
  const config = await getDeployments(networkId);
  const creditDeskAddress = config.contracts.CreditDesk.address;
  const creditDesk = new web3.eth.Contract(config.contracts.CreditDesk.abi, creditDeskAddress);
  return creditDesk;
}

export { getCreditDesk };
