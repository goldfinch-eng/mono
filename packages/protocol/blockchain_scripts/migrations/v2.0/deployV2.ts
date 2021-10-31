import hre from "hardhat"
import {
  deployPoolTokens,
  deploySeniorPool,
  deployTranchedPool,
  deployMigratedTranchedPool,
  deploySeniorPoolStrategy,
  deployBorrower,
  deployClImplementation,
} from "../../baseDeploy"
import {UpgradedContracts} from "../../mainnetForkingHelpers"
import {asNonNullable} from "@goldfinch-eng/utils"
import {Fidu, GoldfinchConfig} from "../../../typechain/ethers"

async function deployV2(contracts: UpgradedContracts, opts: {noFidu?: boolean} = {}) {
  const config = asNonNullable(contracts.GoldfinchConfig?.UpgradedContract) as GoldfinchConfig
  const fidu = opts.noFidu ? undefined : (asNonNullable(contracts.Fidu?.UpgradedContract) as Fidu)
  const seniorPool = await deploySeniorPool(hre, {config, fidu})
  const seniorPoolStrategy = await deploySeniorPoolStrategy(hre, {config})
  const tranchedPool = await deployTranchedPool(hre, {config})
  const poolTokens = await deployPoolTokens(hre, {config})
  const migratedTranchedPool = await deployMigratedTranchedPool(hre, {config})
  await deployClImplementation(hre, {config})
  await deployBorrower(hre, {config})
  return {seniorPool, seniorPoolStrategy, tranchedPool, poolTokens, migratedTranchedPool}
}

export default deployV2
