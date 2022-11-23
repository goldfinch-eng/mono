import {HardhatRuntimeEnvironment} from "hardhat/types"
import * as migrate310 from "../blockchain_scripts/migrations/v3.1.0/migrate"
import * as migrate311 from "../blockchain_scripts/migrations/v3.1.1/migrate"

/*
 * Setup pending mainnet migration contracts in the Goldfinch contract ecosystem.
 * As we move the hardhat mainnet fork forward, migrations should be moved from
 * this deploy script in to the baseDeploy script if they have already been run
 * on mainnet before the hard mainnet fork block num.
 */
async function main(hre: HardhatRuntimeEnvironment) {
  console.log("Running pending mainnet migrations...")
  await migrate310.main()
  await migrate311.main()

  console.log("Ran pending mainnet migrations...")
}

module.exports = main
module.exports.dependencies = ["baseDeploy"]
module.exports.tags = ["pendingMainnetMigrations"]
