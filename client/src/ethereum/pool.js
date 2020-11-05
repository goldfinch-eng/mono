import web3 from '../web3';
import BigNumber from 'bignumber.js';
import { mapNetworkToID, fetchDataFromAttributes, getDeployments, USDC_DECIMALS } from './utils.js';
import { getErc20 } from './erc20';
import { getFidu, FIDU_DECIMALS } from './fidu';

let pool;

async function getPool(networkName) {
  const networkId = mapNetworkToID[networkName];
  const config = await getDeployments(networkId);
  const poolAddress = config.contracts.Pool.address;
  pool = new web3.eth.Contract(config.contracts.Pool.abi, poolAddress);
  pool.usdc = await getErc20(networkName);
  pool.fidu = await getFidu(networkName);
  return pool;
}

async function fetchCapitalProviderData(pool, capitalProviderAddress) {
  var result = {};
  if (!capitalProviderAddress || !pool) {
    return Promise.resolve(result);
  }
  const attributes = [{ method: 'sharePrice' }];
  result = await fetchDataFromAttributes(pool, attributes);
  result.numShares = await pool.fidu.methods.balanceOf(capitalProviderAddress).call();
  result.availableToWithdrawal = new BigNumber(result.numShares)
    .multipliedBy(new BigNumber(result.sharePrice))
    .div(FIDU_DECIMALS);
  result.address = capitalProviderAddress;
  result.allowance = new BigNumber(await pool.usdc.methods.allowance(capitalProviderAddress, pool._address).call());
  return result;
}

async function fetchPoolData(pool, erc20) {
  var result = {};
  if (!erc20 || !pool) {
    return Promise.resolve(result);
  }
  const attributes = [{ method: 'sharePrice' }];
  result = await fetchDataFromAttributes(pool, attributes);
  result.balance = await erc20.methods.balanceOf(pool._address).call();
  result.totalShares = await pool.fidu.methods.totalSupply().call();

  // Do some slightly goofy multiplication and division here so that we have consistent units across
  // 'balance', 'totalPoolBalance', and 'totalDrawdowns', allowing us to do arithmetic between them
  // and display them using the same helpers.
  const totalPoolBalanceInDollars = new BigNumber(result.totalShares)
    .div(FIDU_DECIMALS)
    .multipliedBy(new BigNumber(result.sharePrice))
    .div(FIDU_DECIMALS);
  result.totalPoolBalance = totalPoolBalanceInDollars.multipliedBy(USDC_DECIMALS);
  result.totalDrawdowns = result.totalPoolBalance - result.balance;
  return result;
}

export { getPool, fetchCapitalProviderData, fetchPoolData };
