import web3 from '../web3';
import { getDeployments } from './utils';

async function getCreditDesk(networkId) {
  const config = await getDeployments(networkId);
  const creditDeskAddress = config.contracts.CreditDesk.address;
  const creditDesk = new web3.eth.Contract(config.contracts.CreditDesk.abi, creditDeskAddress);
  return creditDesk;
}

export { getCreditDesk };
