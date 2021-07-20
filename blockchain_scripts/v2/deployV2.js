const {toTruffle} = require("../../test/testHelpers")
const hre = require("hardhat")
const {
  deployPoolTokens,
  deploySeniorFund,
  deployTranchedPool,
  deployMigratedTranchedPool,
  deploySeniorFundStrategy,
  deployBorrower,
  deployClImplementation,
} = require("../baseDeploy")

async function deployV2(contracts, asTruffle = true) {
  const config = contracts.GoldfinchConfig.UpgradedContract
  const fidu = contracts.Fidu.UpgradedContract
  let seniorPool = await deploySeniorFund(hre, {config, fidu})
  let seniorFundStrategy = await deploySeniorFundStrategy(hre, {config})
  let tranchedPool = await deployTranchedPool(hre, {config})
  let poolTokens = await deployPoolTokens(hre, {config})
  let migratedTranchedPool = await deployMigratedTranchedPool(hre, {config})
  if (asTruffle) {
    seniorPool = await toTruffle(seniorPool, "SeniorFund")
    seniorFundStrategy = await toTruffle(seniorFundStrategy, "IFundStrategy")
    tranchedPool = await toTruffle(tranchedPool, "TranchedPool")
    poolTokens = await toTruffle(poolTokens, "PoolTokens")
    migratedTranchedPool = await toTruffle(migratedTranchedPool, "MigratedTranchedPool")
  }
  await deployClImplementation(hre, {config})
  await deployBorrower(hre, {config})
  await contracts.GoldfinchConfig.UpgradedContract.bulkAddToGoList([seniorPool.address])
  return {seniorPool, seniorFundStrategy, tranchedPool, poolTokens, migratedTranchedPool}
}

module.exports = deployV2
