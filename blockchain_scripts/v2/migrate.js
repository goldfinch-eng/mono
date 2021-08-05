const hre = require("hardhat")
const {getNamedAccounts, deployments, artifacts} = hre
const deployV2 = require("./deployV2")
// const DefenderWrapper = require("../adminActions/defenderWrapper")
const {MINTER_ROLE, OWNER_ROLE, PAUSER_ROLE, GO_LISTER_ROLE, getContract} = require("../deployHelpers")
const {borrowerCreditlines, getMigrationData} = require("./migrationHelpers")
const {
  MAINNET_MULTISIG,
  upgradeContracts,
  getExistingContracts,
  getMainnetTruffleContracts,
} = require("../mainnetForkingHelpers")
const {ethers} = require("hardhat")
const _ = require("lodash")
const {decodeLogs} = require("../../test/testHelpers")
const goList = require("../../client/src/goList.json")

const args = process.argv.slice(2)

async function main() {
  const step = args[0]
  // TODO: Set Ethers library to have a default "fast" gas speed

  /* eslint-disable indent */
  switch (step) {
    case "step=0": {
      await prepareMigration()
      break
    }
    case "step=1": {
      await deployAndMigrateToV2()
      break
    }
    default: {
      throw new Error(`Unknown step ${step} passed in`)
    }
  }
  /* eslint-enable indent */
}

async function prepareMigration() {
  const mainnetContracts = await getMainnetTruffleContracts()
  const config = mainnetContracts.GoldfinchConfig
  const pool = mainnetContracts.Pool
  const creditDesk = mainnetContracts.CreditDesk
  const goldfinchConfig = mainnetContracts.GoldfinchConfig
  const goldfinchFactory = mainnetContracts.GoldfinchFactory
  const fidu = mainnetContracts.Fidu

  const migrator = await deployMigrator(hre, {config})
  await givePermsToMigrator({pool, oldConfig: config, creditDesk, goldfinchConfig, goldfinchFactory, fidu, migrator})
  return migrator
}

async function deployAndMigrateToV2() {
  const {gf_deployer} = await getNamedAccounts()
  const migrator = await getContract("V2Migrator", {from: gf_deployer})
  console.log("Deploying new contracts...")
  const result = await handleNewDeployments(migrator)
  console.log("Migrating phase 1!")
  await migrator.migratePhase1(result.goldfinchConfig, [
    result.pool,
    result.creditDesk,
    result.fidu,
    result.goldfinchFactory,
  ])

  console.log("Getting the migration data...")
  const [ownersWithCls, clMigrationData] = await getAllMigrationData(result.existingPool)
  const chunkedOwnersWithCls = _.chunk(ownersWithCls, 5)
  const chunkedClMigrationData = _.chunk(clMigrationData, 5)
  const migrationTxs = await Promise.all(
    chunkedOwnersWithCls.map(async (ownerChunk, i) => {
      console.log("Migrating creditline chunk:", i)
      return migrator.migrateCreditLines(result.goldfinchConfig, ownerChunk, chunkedClMigrationData[i])
    })
  )
  console.log("Adding everyone to the goList...")
  await addEveryoneToTheGoList(result.goldfinchConfig, migrator)
  console.log("Closing out the migration...")
  await closingOutTheMigration(result.goldfinchConfig, migrator)
  return extractAllMigrationEvents(migrationTxs, migrator)
}

async function closingOutTheMigration(goldfinchConfigAddress, migrator) {
  return migrator.closeOutMigration(goldfinchConfigAddress)
}

async function addEveryoneToTheGoList(goldfinchConfigAddress, migrator) {
  const chunkedGoList = _.chunk(goList, 375)
  await Promise.all(
    chunkedGoList.map(async (chunk, i) => {
      console.log("adding chunk", i, "to the goList")
      return migrator.bulkAddToGoList(goldfinchConfigAddress, chunk)
    })
  )
}

function extractAllMigrationEvents(migrationTxs, migrator) {
  return _.flatten(
    migrationTxs.map((tx) => {
      return extractMigrationEvent(tx, migrator)
    })
  )
}

function extractMigrationEvent(tx, migrator) {
  return decodeLogs(tx.receipt.rawLogs, migrator, "CreditLineMigrated")
}

async function getAllMigrationData(pool) {
  let ownerClData = []
  let migrationData = []
  await Promise.all(
    Object.entries(borrowerCreditlines).map(async ([cl, clData]) => {
      ownerClData.push([cl, clData.owner])
      const data = await getMigrationData(cl, {address: pool})
      const orderedData = [
        String(data.termEndTime), // termEndTime
        String(data.nextDueTime), // nextDueTime
        String(data.interestAccruedAsOf), // interestAccruedAsOf,
        String(data.lastFullPaymentTime), // lastFullPaymentTime,
        String(data.totalInterestPaid), // totalInterestPaid,
        String(data.totalPrincipalPaid), // totalPrincipalPaid
      ]
      migrationData.push(orderedData)
    })
  )
  return [ownerClData, migrationData]
}

async function handleNewDeployments(migrator) {
  const contractsToUpgrade = ["Pool", "CreditDesk", "Fidu", "GoldfinchFactory", "GoldfinchConfig"]
  const {gf_deployer} = await getNamedAccounts()
  const existingContracts = await getExistingContracts(contractsToUpgrade, null, gf_deployer)
  const upgradedContracts = await upgradeContracts(
    contractsToUpgrade,
    existingContracts,
    gf_deployer,
    gf_deployer,
    deployments,
    false
  )
  const newConfig = upgradedContracts.GoldfinchConfig.UpgradedContract

  // Set the deployer, governance, and migrator as owners of the config. Will revoke later
  await newConfig.initialize(gf_deployer)
  await newConfig.initializeFromOtherConfig(existingContracts.GoldfinchConfig.ExistingContract.address)
  await newConfig.grantRole(OWNER_ROLE, MAINNET_MULTISIG)
  await newConfig.grantRole(OWNER_ROLE, migrator.address)
  await newConfig.grantRole(GO_LISTER_ROLE, migrator.address)
  await deployV2(upgradedContracts, {noFidu: true, config: newConfig})

  return {
    pool: upgradedContracts.Pool.UpgradedImplAddress,
    creditDesk: upgradedContracts.CreditDesk.UpgradedImplAddress,
    fidu: upgradedContracts.Fidu.UpgradedImplAddress,
    goldfinchFactory: upgradedContracts.GoldfinchFactory.UpgradedImplAddress,
    goldfinchConfig: newConfig.address,
    gf_deployer: gf_deployer,
    existingPool: existingContracts.Pool.ExistingContract.address,
  }
}

async function givePermsToMigrator({pool, creditDesk, goldfinchFactory, fidu, migrator, oldConfig}) {
  // Give owner roles to the migrator
  await pool.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await creditDesk.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await goldfinchFactory.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await fidu.grantRole(MINTER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await fidu.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await oldConfig.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_MULTISIG})

  await pool.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await creditDesk.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await goldfinchFactory.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_MULTISIG})
  await fidu.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_MULTISIG})

  // Transfer proxy ownership to migrator
  await (
    await artifacts.require("IBase").at(pool.address)
  ).transferOwnership(migrator.address, {from: MAINNET_MULTISIG})
  await (
    await artifacts.require("IBase").at(creditDesk.address)
  ).transferOwnership(migrator.address, {from: MAINNET_MULTISIG})
  await (
    await artifacts.require("IBase").at(goldfinchFactory.address)
  ).transferOwnership(migrator.address, {from: MAINNET_MULTISIG})
  await (
    await artifacts.require("IBase").at(fidu.address)
  ).transferOwnership(migrator.address, {from: MAINNET_MULTISIG})
}

async function deployMigrator(hre, {config}) {
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const {gf_deployer} = await getNamedAccounts()
  const contractName = "V2Migrator"
  let deployResult = await deploy(contractName, {
    from: gf_deployer,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [gf_deployer, config.address],
        },
      },
    },
  })
  console.log("Got done deploying...!", deployResult.address)
  let deployerSigner = await ethers.getSigner(gf_deployer)
  const migrator = (await ethers.getContractAt(contractName, deployResult.address)).connect(deployerSigner)
  await migrator.grantRole(OWNER_ROLE, MAINNET_MULTISIG)
  return migrator
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = {deployMigrator, givePermsToMigrator, deployAndMigrateToV2, handleNewDeployments, prepareMigration}
