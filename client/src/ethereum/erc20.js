import web3 from '../web3';
import BigNumber from 'bignumber.js';
import * as ERC20Contract from './ERC20.json';
import { mapNetworkToID, decimals, USDC_ADDRESSES, getConfig } from './utils';

async function getErc20(networkName) {
  const networkId = mapNetworkToID[networkName];
  const config = await getConfig(networkId);
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

function fromAtomic(amount) {
  return new BigNumber(String(amount)).div(decimals).toString(10);
}

function toAtomic(amount) {
  return new BigNumber(String(amount)).multipliedBy(decimals).toString(10);
}

export { getErc20, decimals, fromAtomic, toAtomic };
