const {toAtomic, getDeployedContract, updateConfig, CONFIG_KEYS} = require("./deployHelpers.js")
const PROTOCOL_CONFIG = require("../protocol_config.json")
const hre = require("hardhat")

/*
This deployment updates the configs from the PROTOCOL_CONFIG
*/
let logger

async function main() {
  await updateConfigs(hre, PROTOCOL_CONFIG)
}

async function updateConfigs(hre, protocolConfig) {
  const {deployments} = hre

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log

  const config = await getDeployedContract(deployments, "GoldfinchConfig")

  const maxUnderwriterLimit = String(protocolConfig.maxUnderwriterLimit)
  const transactionLimit = String(protocolConfig.transactionLimit)
  const totalFundsLimit = String(protocolConfig.totalFundsLimit)
  const latenessGracePeriod = String(protocolConfig.latenessGracePeriod)

  const withdrawFeeDenominator = String(protocolConfig.withdrawFeeDenominator)
  const reserveDenominator = String(protocolConfig.reserveDenominator)
  const latenessMaxDays = String(protocolConfig.latenessMaxDays)

  await updateConfig(config, "number", CONFIG_KEYS.MaxUnderwriterLimit, toAtomic(maxUnderwriterLimit))
  await updateConfig(config, "number", CONFIG_KEYS.TransactionLimit, toAtomic(transactionLimit))
  await updateConfig(config, "number", CONFIG_KEYS.TotalFundsLimit, toAtomic(totalFundsLimit))
  await updateConfig(config, "number", CONFIG_KEYS.ReserveDenominator, reserveDenominator)
  await updateConfig(config, "number", CONFIG_KEYS.WithdrawFeeDenominator, withdrawFeeDenominator)
  await updateConfig(config, "number", CONFIG_KEYS.LatenessGracePeriodInDays, latenessGracePeriod)
  await updateConfig(config, "number", CONFIG_KEYS.LatenessMaxDays, latenessMaxDays)

  logger("Done")
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = updateConfigs
