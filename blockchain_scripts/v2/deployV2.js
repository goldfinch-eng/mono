const {toTruffle} = require("../../test/testHelpers")
const hre = require("hardhat")
const {
  deployPoolTokens,
  deploySeniorPool,
  deployTranchedPool,
  deployMigratedTranchedPool,
  deploySeniorPoolStrategies,
  deployBorrower,
  deployClImplementation,
} = require("../baseDeploy")

async function deployV2(contracts, opts = {}) {
  opts.asTruffle = opts.asTruffle === undefined ? true : opts.asTruffle
  const config = contracts.GoldfinchConfig.UpgradedContract
  const fidu = opts.noFidu ? null : contracts.Fidu.UpgradedContract
  let seniorPool = await deploySeniorPool(hre, {config, fidu})
  let [seniorPoolFixedStrategy, seniorPoolDynamicStrategy] = await deploySeniorPoolStrategies(hre, {config})
  let tranchedPool = await deployTranchedPool(hre, {config})
  let poolTokens = await deployPoolTokens(hre, {config})
  let migratedTranchedPool = await deployMigratedTranchedPool(hre, {config})
  if (opts.asTruffle) {
    seniorPool = await toTruffle(seniorPool, "SeniorPool")
    seniorPoolFixedStrategy = await toTruffle(seniorPoolFixedStrategy, "ISeniorPoolStrategy")
    seniorPoolDynamicStrategy = await toTruffle(seniorPoolDynamicStrategy, "ISeniorPoolStrategy")
    tranchedPool = await toTruffle(tranchedPool, "TranchedPool")
    poolTokens = await toTruffle(poolTokens, "PoolTokens")
    migratedTranchedPool = await toTruffle(migratedTranchedPool, "MigratedTranchedPool")
  }
  await deployClImplementation(hre, {config})
  await deployBorrower(hre, {config})
  await config.bulkAddToGoList([seniorPool.address])
  return {
    seniorPool,
    seniorPoolFixedStrategy,
    seniorPoolDynamicStrategy,
    tranchedPool,
    poolTokens,
    migratedTranchedPool,
  }
}

module.exports = deployV2
