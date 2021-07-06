const {getDeployedContract} = require("../deployHelpers.js")
const {CHAIN_NAME_BY_ID} = require("../deployHelpers.js")
const hre = require("hardhat")
const {DefenderUpgrader} = require("../upgrade.js")

let logger = console.log

async function main() {
  await updateContractConfigs(hre)
}

async function updateContractConfigs(hre) {
  let contractsToUpgrade = process.env.CONTRACTS || "GoldfinchFactory, CreditDesk, Pool, Fidu"
  logger(`Updating GoldfinchConfig on: ${contractsToUpgrade}`)
  contractsToUpgrade = contractsToUpgrade.split(/[ ,]+/)

  const chainId = await hre.getChainId()
  const network = CHAIN_NAME_BY_ID[chainId]
  let defender = new DefenderUpgrader({hre, logger, chainId, network})

  for (let i = 0; i < contractsToUpgrade.length; i++) {
    let contractName = contractsToUpgrade[i]
    let contract = await getDeployedContract(hre.deployments, contractName)
    await defender.updateGoldfinchConfig(contractName, contract)
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = {updateContractConfigs}
