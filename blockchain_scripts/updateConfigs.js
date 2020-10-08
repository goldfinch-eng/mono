const { fromAtomic, toAtomic, getDeployedContract } = require("./deployHelpers.js");
const PROTOCOL_CONFIG = require("../protocol_config.json");
const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;

/*
This deployment updates the configs from the PROTOCOL_CONFIG
*/
let logger;

async function main() {
  await updateConfigs(bre, PROTOCOL_CONFIG);
}

async function updateConfigs(bre, protocolConfig) {
  const { deployments } = bre;

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log;

  const pool = await getDeployedContract(deployments, "Pool");
  const creditDesk = await getDeployedContract(deployments, "CreditDesk");

  const underwriterLimit = String(protocolConfig.maxUnderwriterLimit);
  const transactionLimit = String(protocolConfig.transactionLimit);
  const totalFundsLimit = String(protocolConfig.totalFundsLimit);

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

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });

}

module.exports = updateConfigs;