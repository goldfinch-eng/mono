import {HardhatRuntimeEnvironment} from "hardhat/types"

import {main as migrate1_0_0} from "../blockchain_scripts/migrations/migrate1_0_0"

/**
 * Setup pending mainnet migration contracts in the Goldfinch contract ecosystem.
 * As we move the hardhat mainnet fork forward, migrations should be moved from
 * this deploy script in to the baseDeploy script if they have already been run
 * on mainnet before the hard mainnet fork block num.
 */
async function main(hre: HardhatRuntimeEnvironment) {
  //console.log("No pending mainnet migrations...")
  console.log("Running pending mainnet migrations...")
  await migrate1_0_0()
  console.log("Ran pending mainnet migrations...")
}

module.exports = main
module.exports.tags = ["pendingMainnetMigrations"]

module.exports.skip = () => !process.env.HARDHAT_FORK_CHAIN_ID
