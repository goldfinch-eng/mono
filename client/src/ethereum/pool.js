import web3 from '../web3';
import BN from 'bn.js';
import * as PoolContract from '../../../artifacts/Pool.json';
import * as ProtocolConfig from '../../config/protocol-local.json';
import { erc20, decimals } from "./erc20.js";
const pool = new web3.eth.Contract(PoolContract.abi, ProtocolConfig.pool.address);

function fetchCapitalProviderData(capitalProviderAddress) {
  if (!capitalProviderAddress) {
    return {};
  }
  const attributes = [
    {method: "totalShares"},
    {method: "sharePrice"},
    {method: "capitalProviders", args: [capitalProviderAddress], name: "numShares"}
  ];
  return fetchDataFromAttributes(attributes).then((result) => {

    result.availableToWithdrawal = new BN(result.numShares).mul(new BN(result.sharePrice)).div(decimals);
    result.address = capitalProviderAddress;

    return result;
  });
}

function fetchPoolData() {
  const attributes = [
    {method: "totalShares"},
    {method: "sharePrice"},
  ];
  return fetchDataFromAttributes(attributes).then((result) => {
    return erc20.methods.balanceOf(pool._address).call().then((balance) => {
      result.balance = balance;
      return result;
    })
  });
}

function fetchDataFromAttributes(attributes) {
  const result = {};
  var promises = attributes.map((methodInfo) => { return pool.methods[methodInfo.method](...(methodInfo.args || [])).call() });
  return Promise.all(promises).then((results) => {
    attributes.forEach((methodInfo, index) => {
      result[methodInfo.name || methodInfo.method] = results[index];
    });
    return result;
  });
}

export {
  pool,
  fetchCapitalProviderData,
  fetchPoolData,
}
