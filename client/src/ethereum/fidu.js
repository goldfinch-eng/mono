import web3 from '../web3';
import BigNumber from 'bignumber.js';
import { getDeployments, ETHDecimals } from './utils';

async function getFidu(networkId) {
  const config = await getDeployments(networkId);
  const fiduContract = config.contracts.Fidu;
  const fidu = new web3.eth.Contract(fiduContract.abi, fiduContract.address);
  fidu.chain = networkId;
  return fidu;
}

const FIDU_DECIMALS = ETHDecimals;

function fiduFromAtomic(amount) {
  return new BigNumber(String(amount)).div(FIDU_DECIMALS).toString(10);
}

function fiduToAtomic(amount) {
  return new BigNumber(String(amount)).multipliedBy(FIDU_DECIMALS).toString(10);
}

export { getFidu, FIDU_DECIMALS, fiduFromAtomic, fiduToAtomic };
