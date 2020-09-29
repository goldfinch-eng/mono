const BN = require('bn.js');
const {MAINNET_CHAIN_ID, LOCAL, CHAIN_MAPPING, getUSDCAddress, USDCDecimals, ETHDecimals} = require("../blockchain_scripts/deployHelpers.js");
const PROTOCOL_CONFIG = require('../protocol_config.json');

/*
This deployment updates the configs from the PROTOCOL_CONFIG 
*/
let logger;
async function main({ getNamedAccounts, deployments, getChainId }) {
  const { getOrNull, log } = deployments;
  logger = log;
  const { protocol_owner, proxy_owner } = await getNamedAccounts();
  let chainID = await getChainId();
  const pool = await getDeployedAsEthersContract(getOrNull, "Pool");
  const creditDesk = await getDeployedAsEthersContract(getOrNull, "CreditDesk");

  const underwriter = process.env.UNDERWRITER || protocol_owner;
  const rawUnderWriterLimit = process.env.UNDERWRITER_LIMIT || PROTOCOL_CONFIG.maxUnderwriterLimit;
  
  const underwriterLimit = String(new BN(rawUnderWriterLimit).mul(USDCDecimals));

  await setMaxUnderwriterLimit(creditDesk, underwriterLimit);
  await setUnderwriterGovernanceLimit(creditDesk, underwriter, underwriterLimit);

  logger("Done");
};

async function setMaxUnderwriterLimit(creditDesk, newLimit) {
  currentLimit = await creditDesk.maxUnderwriterLimit();

  if(currentLimit != newLimit) {
    logger(`Changing maxUnderwriter limit from ${currentLimit} to ${newLimit}`);
    await (await creditDesk.setMaxUnderwriterLimit(newLimit)).wait();
    logger(`maxUnderwriterLimit set to ${newLimit}`);
  }
}

async function setUnderwriterGovernanceLimit(creditDesk, underwriter, newLimit) {
  underwriterStruct = await creditDesk.underwriters(underwriter);
  // This can either be the limit itself or a hash containing the limit
  currentLimit = underwriterStruct.governanceLimit || underwriterStruct;

  if(!currentLimit.gt(new BN(0))) {
    logger(`Unknown underwriter ${underwriter}`);
  } else if (currentLimit != newLimit) {
    logger(`Changing limit for ${underwriter} from ${currentLimit} to ${newLimit}`);
    await (await creditDesk.setUnderwriterGovernanceLimit(underwriter, newLimit)).wait();
    logger(`Governance limit set to ${newLimit}`);
  }
}

async function getDeployedAsEthersContract(getter, name) {
  logger("Trying to get the deployed version of...", name);
  const deployed = await getter(name);
  if (!deployed) {
    return null;
  }
  return await ethers.getContractAt(deployed.abi, deployed.address);
}

module.exports = main;
module.exports.dependencies = ["base_deploy"];
module.exports.tags = ["update_configs"];
