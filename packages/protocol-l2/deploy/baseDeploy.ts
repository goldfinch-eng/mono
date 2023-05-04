import {HardhatRuntimeEnvironment} from "hardhat/types"
import {baseDeploy} from "../blockchain_scripts/baseDeploy"
import {isMainnetForking} from "../blockchain_scripts/deployHelpers"

/**
 * Setup deployed contracts in the Goldfinch contract ecosystem.
 * Skip this task if we are forking mainnet, as those contracts should already exist in the mainnet fork.
 */
async function main(hre: HardhatRuntimeEnvironment) {
  console.log("Running baseDeploy script...")
  await baseDeploy(hre)
  console.log("Ran baseDeploy script")
}

module.exports = main
module.exports.tags = ["baseDeploy"]
module.exports.skip = isMainnetForking
