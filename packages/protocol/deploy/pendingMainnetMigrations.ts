import {HardhatRuntimeEnvironment} from "hardhat/types"

import * as migrate332 from "../blockchain_scripts/migrations/v3.3.2/migrate3_3_2"

/**
 * Setup pending mainnet migration contracts in the Goldfinch contract ecosystem.
 * As we move the hardhat mainnet fork forward, migrations should be moved from
 * this deploy script in to the baseDeploy script if they have already been run
 * on mainnet before the hard mainnet fork block num.
 */
async function main(hre: HardhatRuntimeEnvironment) {
  // console.log("No pending mainnet migrations...")
  console.log("Running pending mainnet migrations...")
  await migrate332.main()
  console.log("Ran pending mainnet migrations...")
}

module.exports = main
module.exports.tags = ["pendingMainnetMigrations"]

module.exports.skip = () => process.env.HARDHAT_FORK !== "mainnet"
