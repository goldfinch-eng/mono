const { fromAtomic, toAtomic } = require("./deployHelpers.js");
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

  const underwriterLimit = String(PROTOCOL_CONFIG.maxUnderwriterLimit);
  const transactionLimit = String(PROTOCOL_CONFIG.transactionLimit);
  const totalFundsLimit = String(PROTOCOL_CONFIG.totalFundsLimit);

  await setMaxUnderwriterLimit(creditDesk, underwriterLimit);
  await setTransactionLimit(creditDesk, transactionLimit);
  await setTotalFundsLimit(pool, creditDesk, totalFundsLimit);

  logger("Done");
}

async function setMaxUnderwriterLimit(creditDesk, newLimit) {
  const currentLimit = fromAtomic(await creditDesk.maxUnderwriterLimit());

  if(currentLimit !== newLimit) {
    logger(`Changing maxUnderwriter limit from ${currentLimit} to ${newLimit}`);
    await (await creditDesk.setMaxUnderwriterLimit(toAtomic(newLimit))).wait();
    logger(`maxUnderwriterLimit set to ${toAtomic(newLimit)}`);
  } else {
    logger(`maxUnderwriterLimit unchanged at ${currentLimit}`);
  }
}

async function setTransactionLimit(creditDesk, newLimit) {
  const currentLimit = fromAtomic(await creditDesk.transactionLimit());
  if(currentLimit !== newLimit) {
    logger(`Changing transaction limit from ${currentLimit} to ${newLimit}`);
    await (await creditDesk.setTransactionLimit(toAtomic(newLimit))).wait();
    logger(`transactionLimit set to ${toAtomic(newLimit)}`);
  } else {
    logger(`transactionLimit unchanged at ${currentLimit}`);
  }
}

async function setTotalFundsLimit(pool, creditDesk, newLimit) {
  const currentLimit = fromAtomic(await pool.totalFundsLimit());
  if(currentLimit !== newLimit) {
    logger(`Changing total funds limit from ${currentLimit} to ${newLimit}`);
    await (await creditDesk.setPoolTotalFundsLimit(toAtomic(newLimit))).wait();
    logger(`totalFundsLimit set to ${toAtomic(newLimit)}`);
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