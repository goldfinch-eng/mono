const {toAtomic, getDeployedContract, updateConfig, CONFIG_KEYS} = require("./deployHelpers.js")
const PROTOCOL_CONFIG = require("../protocol_config.json")
const bre = require("@nomiclabs/buidler")

/*
This deployment updates the configs from the PROTOCOL_CONFIG
*/
let logger

async function main() {
  await updateConfigs(bre, PROTOCOL_CONFIG)
}

async function updateConfigs(bre, protocolConfig) {
  const {deployments} = bre

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log

  const config = await getDeployedContract(deployments, "GoldfinchConfig")

  const underwriterLimit = String(protocolConfig.maxUnderwriterLimit)
  const transactionLimit = String(protocolConfig.transactionLimit)
  const totalFundsLimit = String(protocolConfig.totalFundsLimit)

  await updateConfig(config, "number", CONFIG_KEYS.MaxUnderwriterLimit, toAtomic(underwriterLimit))
  await updateConfig(config, "number", CONFIG_KEYS.TransactionLimit, toAtomic(transactionLimit))
  await updateConfig(config, "number", CONFIG_KEYS.TotalFundsLimit, toAtomic(totalFundsLimit))

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
