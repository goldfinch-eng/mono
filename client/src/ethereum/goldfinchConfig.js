import web3 from '../web3';
import { fetchDataFromAttributes, getDeployments } from './utils.js';
import { CONFIG_KEYS } from '../../../blockchain_scripts/deployHelpers';

async function getGoldfinchConfig(networkId) {
  const deployments = await getDeployments(networkId);
  const goldfinchConfigAddress = deployments.contracts.GoldfinchConfig.address;
  const config = new web3.eth.Contract(deployments.contracts.GoldfinchConfig.abi, goldfinchConfigAddress);
  return config;
}

async function refreshGoldfinchConfigData(goldfinchConfigContract) {
  if (!goldfinchConfigContract) {
    return Promise.resolve({});
  }
  const attributes = [{ method: 'getNumber', args: [CONFIG_KEYS.TransactionLimit], name: 'transactionLimit' }];
  const data = await fetchDataFromAttributes(goldfinchConfigContract, attributes);
  return { ...goldfinchConfigContract, ...data };
}

export { getGoldfinchConfig, refreshGoldfinchConfigData };
