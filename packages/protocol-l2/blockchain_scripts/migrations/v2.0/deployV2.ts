import hre from "hardhat"
import {
  // @ts-expect-error Ignore obsolete broken import because code is deprecated.
  deployPoolTokens,
  // @ts-expect-error Ignore obsolete broken import because code is deprecated.
  deploySeniorPool,
  // @ts-expect-error Ignore obsolete broken import because code is deprecated.
  deployTranchedPool,
  // @ts-expect-error Ignore obsolete broken import because code is deprecated.
  deployMigratedTranchedPool,
  // @ts-expect-error Ignore obsolete broken import because code is deprecated.
  deploySeniorPoolStrategy,
  // @ts-expect-error Ignore obsolete broken import because code is deprecated.
  deployBorrower,
  // @ts-expect-error Ignore obsolete broken import because code is deprecated.
  deployClImplementation,
} from "../../baseDeploy"
import {UpgradedContracts} from "../../deployHelpers/upgradeContracts"
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
