import web3 from '../web3';
import BigNumber from 'bignumber.js';
import * as ERC20Contract from './ERC20.json';
import { mapNetworkToID, decimals, USDC_ADDRESSES, getDeployments } from './utils';

async function getErc20(networkName) {
  const networkId = mapNetworkToID[networkName];
  const config = await getDeployments(networkId);
  const deployedErc20 = config.contracts.TestERC20;
  let address;
  if (deployedErc20) {
    address = deployedErc20.address;
  } else {
    // Assume we're on testnet or mainnet
    address = USDC_ADDRESSES[networkId];
  }
  const erc20 = new web3.eth.Contract(ERC20Contract.abi, address);
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

export { getErc20, decimals, usdcFromAtomic, usdcToAtomic, minimumNumber };
