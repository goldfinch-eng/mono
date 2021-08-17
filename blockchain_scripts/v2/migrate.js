const hre = require("hardhat")
const {getNamedAccounts, deployments} = hre
const deployV2 = require("./deployV2")
const Safe = require("@gnosis.pm/safe-core-sdk").default
const {EthersAdapter} = require("@gnosis.pm/safe-core-sdk")
const {
  MINTER_ROLE,
  OWNER_ROLE,
  PAUSER_ROLE,
  GO_LISTER_ROLE,
  getContract,
  getProtocolOwner,
  isMainnetForking,
  MAINNET_CHAIN_ID,
} = require("../deployHelpers")
const {borrowerCreditlines, getMigrationData} = require("./migrationHelpers")
const {
  MAINNET_MULTISIG,
  upgradeContracts,
  getExistingContracts,
  getAllExistingContracts,
  impersonateAccount,
} = require("../mainnetForkingHelpers")
const {ethers, getChainId} = require("hardhat")
const _ = require("lodash")
const {decodeLogs} = require("../../test/testHelpers")
const goList = require("../../client/src/goList.json")
const {DefenderUpgrader} = require("../adminActions/defenderUpgrader")

async function main() {
  const step = process.env.STEP
  /* eslint-disable indent */
  switch (step) {
    case "1": {
      console.log("----------Preparing Migration---------")
      await prepareMigration()
      break
    }
    case "2": {
      const result = await deployAndMigrateToV2()
      console.log("----------Done Migrating---------")
      console.log("result is:", result)
      break
    }
    case "defender": {
      // JUST FOR TESTING
      const protocolOwner = await getProtocolOwner()
      const chainId = await getChainId()
      const pool = await getContract("Pool")
      const defender = new DefenderUpgrader({hre, logger: console.log, chainId})
      await defender.send({
        method: "assets",
        contract: pool,
        args: [],
        contractName: "Pool",
        title: "Testing out delegate call",
        description: "Just doing some testing...",
        via: protocolOwner,
        viaType: "Gnosis Safe",
        metadata: {operationType: "delegateCall"},
      })
      break
    }
    default: {
      throw new Error(`Unknown step ${step} passed in`)
    }
  }
  /* eslint-enable indent */
}

async function prepareMigration() {
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  const existingContracts = await getAllExistingContracts(chainId)
  const config = existingContracts.GoldfinchConfig
  const pool = existingContracts.Pool
  const creditDesk = existingContracts.CreditDesk
  const goldfinchConfig = existingContracts.GoldfinchConfig
  const goldfinchFactory = existingContracts.GoldfinchFactory
  const fidu = existingContracts.Fidu

  const migrator = await deployMigrator(hre, {config})
  const result = await handleNewDeployments(migrator)
  console.log("Succesfully deployed things!")
  await upgradeImplementations(migrator, config.address, [
    result.pool,
    result.creditDesk,
    result.fidu,
    result.goldfinchFactory,
  ])
  await givePermsToMigrator({
    pool,
    oldConfig: config,
    creditDesk,
    goldfinchConfig,
    goldfinchFactory,
    fidu,
    migrator,
  })
  return migrator
}

async function deployAndMigrateToV2() {
  const {gf_deployer} = await getNamedAccounts()
  const migrator = await getContract("V2Migrator", {from: gf_deployer})
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  const existingPool = (await getExistingContracts(["Pool"], gf_deployer, chainId)).Pool
  const existingPoolAddress = existingPool.ExistingContract.address
  const goldfinchConfig = await getContract("GoldfinchConfig")
  if (!(await existingPool.ExistingContract.paused())) {
    console.log("Migrating phase 1")
    await migrator.migratePhase1(goldfinchConfig.address)
    console.log("Done phase 1")
  } else {
    console.log("Pool is paused, so assuming we've already done phase 1 migration...")
  }

  console.log("Getting the migration data...")
  const [ownersWithCls, clMigrationData] = await getAllMigrationData(existingPoolAddress)
  const chunkedOwnersWithCls = _.chunk(ownersWithCls, 5)
  const chunkedClMigrationData = _.chunk(clMigrationData, 5)
  let migrationEvents
  if (ownersWithCls.length > 0) {
    const migrationTxs = await Promise.all(
      chunkedOwnersWithCls.map(async (ownerChunk, i) => {
        return migrator.migrateCreditLines(goldfinchConfig.address, ownerChunk, chunkedClMigrationData[i])
      })
    )
    migrationEvents = extractAllMigrationEvents(migrationTxs, migrator)
  }
  console.log("Adding everyone to the goList...")
  await addEveryoneToTheGoList(goldfinchConfig.address, migrator)
  console.log("Closing out the migration...")
  await closingOutTheMigration(goldfinchConfig.address, migrator)
  return migrationEvents
}

async function closingOutTheMigration(goldfinchConfigAddress, migrator) {
  return migrator.closeOutMigration(goldfinchConfigAddress)
}

async function addEveryoneToTheGoList(goldfinchConfigAddress, migrator) {
  const chunkedGoList = _.chunk(goList, 375)
  for (var i = 0; i < chunkedGoList.length; i++) {
    console.log("adding chunk", i, "to the goList")
    let chunk = chunkedGoList[i]
    await migrator.bulkAddToGoList(goldfinchConfigAddress, chunk)
  }
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
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  await Promise.all(
    Object.entries(borrowerCreditlines[chainId]).map(async ([cl, clData]) => {
      const data = await getMigrationData(cl, {address: pool})
      if (data === null) {
        return
      }
      ownerClData.push([cl, clData.owner])
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
  console.log("Starting new deployments...")
  const contractsToUpgrade = ["Pool", "CreditDesk", "Fidu", "GoldfinchFactory", "GoldfinchConfig"]
  const {gf_deployer} = await getNamedAccounts()
  const protocolOwner = await getProtocolOwner()
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  const existingContracts = await getExistingContracts(contractsToUpgrade, gf_deployer, chainId)
  const upgradedContracts = await upgradeContracts(
    contractsToUpgrade,
    existingContracts,
    gf_deployer,
    gf_deployer,
    deployments,
    false
  )
  const newConfig = await getContract("GoldfinchConfig", {from: gf_deployer})
  // Set the deployer, governance, and migrator as owners of the config. This gets revoked later.
  if (!(await newConfig.hasRole(GO_LISTER_ROLE, migrator.address))) {
    console.log("Initializing the new config...")
    await newConfig.initialize(gf_deployer)
    console.log("initializing from other config...")
    await newConfig.initializeFromOtherConfig(existingContracts.GoldfinchConfig.ExistingContract.address)
    console.log("Granting roles...")
    await newConfig.grantRole(OWNER_ROLE, protocolOwner)
    await newConfig.grantRole(GO_LISTER_ROLE, protocolOwner)
    await newConfig.grantRole(OWNER_ROLE, migrator.address)
    await newConfig.grantRole(GO_LISTER_ROLE, migrator.address)
    console.log("Done granting roles...")
  } else {
    console.log("Config already initialized...")
  }
  console.log("Deploying the V2 contracts...")
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
  if (isMainnetForking()) {
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
  } else {
    console.log("--------Do a multisend tx----------")
    console.log("-----------------------------------")
    console.log("to pool:", pool.address, "grantRole:", "args", OWNER_ROLE, migrator.address)
    console.log("to creditDesk:", creditDesk.address, "grantRole:", "args", OWNER_ROLE, migrator.address)
    console.log("to goldfinchFactory:", goldfinchFactory.address, "grantRole:", "args", OWNER_ROLE, migrator.address)
    console.log("to fidu:", fidu.address, "grantRole:", "args", MINTER_ROLE, migrator.address)
    console.log("to fidu:", fidu.address, "grantRole:", "args", OWNER_ROLE, migrator.address)
    console.log("to oldConfig:", oldConfig.address, "grantRole:", "args", OWNER_ROLE, migrator.address)
    console.log("-------- PAUSER ROLE TX's ----------")
    console.log("to pool:", pool.address, "grantRole:", "args", PAUSER_ROLE, migrator.address)
    console.log("to creditDesk:", creditDesk.address, "grantRole:", "args", PAUSER_ROLE, migrator.address)
    console.log("to goldfinchFactory:", oldConfig.address, "grantRole:", "args", PAUSER_ROLE, migrator.address)
    console.log("to fidu:", fidu.address, "grantRole:", "args", PAUSER_ROLE, migrator.address)
    console.log("----------------END---------------")
  }
}

async function upgradeImplementations(migrator, configAddress, newDeployments) {
  if (isMainnetForking()) {
    const ethersMigrator = await getContract("V2Migrator", {as: "ethers"})
    const tx = {
      to: migrator.address,
      value: "0",
      data: ethersMigrator.interface.encodeFunctionData("upgradeImplementations", [configAddress, newDeployments]),
    }
    await delegateSafeTransaction(tx)
  } else {
    const protocolOwner = await getProtocolOwner()
    const chainId = await getChainId()
    const defender = new DefenderUpgrader({hre, logger: console.log, chainId})
    await defender.send({
      method: "upgradeImplementations",
      contract: migrator,
      args: [configAddress, newDeployments],
      contractName: "V2Migrator",
      title: "Upgrade to V2 Implementations",
      description: "Upgrading our original 4 contracts to have their V2 implementations",
      via: protocolOwner,
      viaType: "Gnosis Safe",
      metadata: {operationType: "delegateCall"},
    })
  }
}

async function deployMigrator(hre, {config}) {
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const {gf_deployer} = await getNamedAccounts()
  const contractName = "V2Migrator"
  console.log("Deploying the migrator...")
  const protocolOwner = await getProtocolOwner()
  await deploy(contractName, {from: gf_deployer})
  const migrator = await getContract("V2Migrator", {from: gf_deployer})
  if (!(await migrator.hasRole(OWNER_ROLE, protocolOwner))) {
    console.log("Initializing the migrator...")
    await migrator.initialize(gf_deployer, config.address)
    await migrator.grantRole(OWNER_ROLE, protocolOwner)
  }
  console.log("Done deploying the migrator...")
  return migrator
}

async function delegateSafeTransaction(tx) {
  const safeAddress = MAINNET_MULTISIG
  const blakesGovAddress = "0xf13eFa505444D09E176d83A4dfd50d10E399cFd5"
  const mikesGovAddress = "0x5E7b1B5d5B03558BA57410e5dc4DbFCA71C92B84"
  await impersonateAccount(hre, blakesGovAddress)
  await impersonateAccount(hre, mikesGovAddress)
  let ownerSigner = await ethers.getSigner(blakesGovAddress)
  let ownerSigner2 = await ethers.getSigner(mikesGovAddress)
  const ethAdapterOwner1 = new EthersAdapter({ethers, signer: ownerSigner})
  const ethAdapterOwner2 = new EthersAdapter({ethers, signer: ownerSigner2})
  const safeSdk = await Safe.create({
    ethAdapter: ethAdapterOwner1,
    safeAddress,
    contractNetworks: {
      31337: {
        multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
        safeMasterCopyAddress: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
        safeProxyFactoryAddress: "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
      },
      1: {
        multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
        safeMasterCopyAddress: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
        safeProxyFactoryAddress: "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
      },
      4: {
        multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
        safeMasterCopyAddress: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
        safeProxyFactoryAddress: "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
      },
    },
  })
  const owner2 = await safeSdk.connect({ethAdapter: ethAdapterOwner2, safeAddress})
  tx.operation = 1
  const transactions = [tx]

  const safeTx = await safeSdk.createTransaction(...transactions)
  const txHash = await owner2.getTransactionHash(safeTx)
  const approveTx = await owner2.approveTransactionHash(txHash)
  await approveTx.transactionResponse.wait()
  const executeTxResponse = await safeSdk.executeTransaction(safeTx)
  const res = await executeTxResponse.transactionResponse.wait()
  const executionResult = _.last(res.events)
  if (executionResult.event === "ExecutionFailure") {
    console.log("res:", res)
    throw new Error("Delegation failed")
  } else if (executionResult.event === "ExecutionSuccess") {
    console.log("Delegation successful!")
  } else {
    console.log("res:", res)
    throw new Error("Unexpected state. Did not detect either success or failure")
  }
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
