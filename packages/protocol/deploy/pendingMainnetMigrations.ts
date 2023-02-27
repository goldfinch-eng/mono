import {HardhatRuntimeEnvironment} from "hardhat/types"

import * as migrate313 from "../blockchain_scripts/migrations/v3.1.3/migrate"
import * as migrate321 from "../blockchain_scripts/migrations/v3.2.1/migrate3_2_1"

/**
 * Setup pending mainnet migration contracts in the Goldfinch contract ecosystem.
 * As we move the hardhat mainnet fork forward, migrations should be moved from
 * this deploy script in to the baseDeploy script if they have already been run
 * on mainnet before the hard mainnet fork block num.
 */
async function main(hre: HardhatRuntimeEnvironment) {
  console.log("Running pending mainnet migrations...")
  await migrate313.main()
  await migrate321.main()
  console.log("Ran pending mainnet migrations...")
}

module.exports = main
module.exports.tags = ["pendingMainnetMigrations"]

module.exports.skip = () => process.env.HARDHAT_FORK !== "mainnet"
