import web3 from '../web3';
import BN from 'bn.js';
import { mapNetworkToID, fetchDataFromAttributes, getConfig } from './utils.js';
import { decimals, getErc20 } from './erc20';

let pool;

async function getPool(networkName) {
  const networkId = mapNetworkToID[networkName];
  const config = await getConfig(networkId);
  const poolAddress = config.contracts.Pool.address;
  pool = new web3.eth.Contract(config.contracts.Pool.abi, poolAddress);
  pool.erc20 = await getErc20(networkName);
  return pool;
}

async function fetchCapitalProviderData(pool, capitalProviderAddress) {
  var result = {};
  if (!capitalProviderAddress || !pool) {
    return Promise.resolve(result);
  }
  const attributes = [
    { method: 'totalShares' },
    { method: 'sharePrice' },
    { method: 'capitalProviders', args: [capitalProviderAddress], name: 'numShares' },
  ];
  result = await fetchDataFromAttributes(pool, attributes);
  result.availableToWithdrawal = new BN(result.numShares).mul(new BN(result.sharePrice)).div(decimals);
  result.address = capitalProviderAddress;
  result.allowance = new BN(await pool.erc20.methods.allowance(capitalProviderAddress, pool._address).call());
  return result;
}

async function fetchPoolData(pool, erc20) {
  var result = {};
  if (!erc20 || !pool) {
    return Promise.resolve(result);
  }
  const attributes = [{ method: 'totalShares' }, { method: 'sharePrice' }];
  result = await fetchDataFromAttributes(pool, attributes);
  result.balance = await erc20.methods.balanceOf(pool._address).call();
  return result;
}

export { getPool, fetchCapitalProviderData, fetchPoolData };
