const BN = require("bn.js");
const { USDCDecimals } = require("./deployHelpers.js");
const PROTOCOL_CONFIG = require("../protocol_config.json");
const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;

/*
This deployment updates the configs from the PROTOCOL_CONFIG
*/
let logger;
async function main() {
  const { deployments } = bre;
  const { getOrNull } = deployments;

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log;

  const pool = await getDeployedAsEthersContract(getOrNull, "Pool");
  const creditDesk = await getDeployedAsEthersContract(getOrNull, "CreditDesk");

  const underwriterLimit = String(new BN(PROTOCOL_CONFIG.maxUnderwriterLimit).mul(USDCDecimals));
  const transactionLimit = String(new BN(PROTOCOL_CONFIG.transactionLimit).mul(USDCDecimals));
  const totalFundsLimit = String(new BN(PROTOCOL_CONFIG.totalFundsLimit).mul(USDCDecimals));

  await setMaxUnderwriterLimit(creditDesk, underwriterLimit);
  await setTransactionLimit(pool, transactionLimit);
  await setTotalFundsLimit(pool, totalFundsLimit);

  logger("Done");
}

async function setMaxUnderwriterLimit(creditDesk, newLimit) {
  const currentLimit = String(await creditDesk.maxUnderwriterLimit());

  if(currentLimit !== newLimit) {
    logger(`Changing maxUnderwriter limit from ${currentLimit} to ${newLimit}`);
    await (await creditDesk.setMaxUnderwriterLimit(newLimit)).wait();
    logger(`maxUnderwriterLimit set to ${newLimit}`);
  } else {
    logger(`maxUnderwriterLimit unchanged at ${currentLimit}`);
  }
}

async function setTransactionLimit(pool, newLimit) {
  const currentLimit = String(await pool.transactionLimit());
  if(currentLimit !== newLimit) {
    logger(`Changing transaction limit from ${currentLimit} to ${newLimit}`);
    await (await pool.setTransactionLimit(newLimit)).wait();
    logger(`transactionLimit set to ${newLimit}`);
  } else {
    logger(`transactionLimit unchanged at ${currentLimit}`);
  }
}

async function setTotalFundsLimit(pool, newLimit) {
  const currentLimit = String(await pool.totalFundsLimit());
  if(currentLimit !== newLimit) {
    logger(`Changing total funds limit from ${currentLimit} to ${newLimit}`);
    await (await pool.setTotalFundsLimit(newLimit)).wait();
    logger(`totalFundsLimit set to ${newLimit}`);
  } else {
    logger(`totalFundsLimit unchanged at ${currentLimit}`);
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

main(bre)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });