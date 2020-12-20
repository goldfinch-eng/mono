import web3 from '../web3';
import BigNumber from 'bignumber.js';
import * as ERC20Contract from './ERC20.json';
import { decimals, USDC_ADDRESSES, getDeployments } from './utils';
let cachedContract;

async function getUSDC(networkId) {
  if (cachedContract) {
    return cachedContract;
  }
  const config = await getDeployments(networkId);
  const deployedUSDC = config.contracts.TestERC20;
  let address;
  if (deployedUSDC) {
    address = deployedUSDC.address;
  } else {
    // Assume we're on testnet or mainnet
    address = USDC_ADDRESSES[networkId];
  }
  const erc20 = new web3.eth.Contract(ERC20Contract.abi, address);
  cachedContract = erc20;
  return erc20;
}

function usdcFromAtomic(amount) {
  return new BigNumber(String(amount)).div(decimals).toString(10);
}

function usdcToAtomic(amount) {
  return new BigNumber(String(amount)).multipliedBy(decimals).toString(10);
}

function minimumNumber(...args) {
  return new BigNumber.minimum(...args).toString(10);
}

export { getUSDC, decimals, usdcFromAtomic, usdcToAtomic, minimumNumber };
