import web3 from '../web3';
import BN from 'bn.js';
import * as PoolContract from '../../../artifacts/Pool.json';
import { mapNetworkToID, transformedConfig } from "./utils.js";
import { decimals } from "./erc20";

let pool;

function getPool(networkName) {
  const networkId = mapNetworkToID[networkName];
  pool = new web3.eth.Contract(PoolContract.abi, transformedConfig()[networkId].contracts.Pool.address);
  return pool;
}

function fetchCapitalProviderData(pool, capitalProviderAddress) {
  if (!capitalProviderAddress) {
    return {};
  }
  const attributes = [
    {method: "totalShares"},
    {method: "sharePrice"},
    {method: "capitalProviders", args: [capitalProviderAddress], name: "numShares"}
  ];
  return fetchDataFromAttributes(pool, attributes).then((result) => {

    result.availableToWithdrawal = new BN(result.numShares).mul(new BN(result.sharePrice)).div(decimals);
    result.address = capitalProviderAddress;

    return result;
  });
}

function fetchPoolData(pool, erc20) {
  if (!erc20 || !pool) {
    return Promise.resolve({});
  }
  const attributes = [
    {method: "totalShares"},
    {method: "sharePrice"},
  ];
  return fetchDataFromAttributes(pool, attributes).then((result) => {
    return erc20.methods.balanceOf(pool._address).call().then((balance) => {
      result.balance = balance;
      return result;
    })
  });
}

function fetchDataFromAttributes(pool, attributes) {
  const result = {};
  if (!pool) {
    return Promise.resolve(result);
  }
  var promises = attributes.map((methodInfo) => { return pool.methods[methodInfo.method](...(methodInfo.args || [])).call() });
  return Promise.all(promises).then((results) => {
    attributes.forEach((methodInfo, index) => {
      result[methodInfo.name || methodInfo.method] = results[index];
    });
    return result;
  });
}

export {
  getPool,
  fetchCapitalProviderData,
  fetchPoolData,
}
