import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import hre, {artifacts, getChainId, getNamedAccounts} from "hardhat"
import _ from "lodash"
import {decodeLogs} from "../../../test/testHelpers"
import {DefenderUpgrader} from "../../adminActions/defenderUpgrader"
import {
  assertIsChainId,
  ContractDeployer,
  getProtocolOwner,
  getTruffleContract,
  GO_LISTER_ROLE,
  isMainnetForking,
  MAINNET_CHAIN_ID,
  MINTER_ROLE,
  OWNER_ROLE,
  PAUSER_ROLE,
} from "../../deployHelpers"
import {getAllExistingContracts} from "../../deployHelpers/getAllExistingContracts"
import {getExistingContracts} from "../../deployHelpers/getExistingContracts"
import {upgradeContracts} from "../../deployHelpers/upgradeContracts"
import {MAINNET_GOVERNANCE_MULTISIG} from "../../mainnetForkingHelpers"
import deployV2 from "./deployV2"
import {borrowerCreditlines, getMigrationData} from "./migrationHelpers"
const goList: any[] = []

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
      const pool = await getTruffleContract("Pool")
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
  assertIsChainId(chainId)
  const existingContracts = await getAllExistingContracts(chainId)
  const config = existingContracts.GoldfinchConfig
  const pool = existingContracts.Pool
  const creditDesk = existingContracts.CreditDesk
  const goldfinchFactory = existingContracts.GoldfinchFactory
  const fidu = existingContracts.Fidu

  const migrator = await deployMigrator(hre, {config})
  const result = await handleNewDeployments(migrator)
  console.log("Succesfully deployed things!")
  await upgradeImplementations(
    migrator,
    config.address,
    [result.pool, result.creditDesk, result.fidu, result.goldfinchFactory],
    {pool, creditDesk, fidu, goldfinchFactory}
  )
  await givePermsToMigrator({
    pool,
    oldConfig: config,
    creditDesk,
    goldfinchFactory,
    fidu,
    migrator,
  })
  return migrator
}

async function deployAndMigrateToV2() {
  const {gf_deployer} = await getNamedAccounts()
  assertNonNullable(gf_deployer)
  const migrator = await getTruffleContract("V2Migrator", {from: gf_deployer})
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  assertIsChainId(chainId)
  const existingPool = (await getExistingContracts(["Pool"], gf_deployer, chainId)).Pool
  assertNonNullable(existingPool)
  const existingPoolAddress = existingPool.ExistingContract.address
  const goldfinchConfig = await getTruffleContract("GoldfinchConfig")
  if (!(await existingPool.ExistingContract.paused())) {
    console.log("Migrating phase 1")
    // @ts-expect-error Broken because V2Migrator contract has been removed.
    await migrator.migratePhase1(goldfinchConfig.address)
    console.log("Done phase 1")
  } else {
    console.log("Pool is paused, so assuming we've already done phase 1 migration...")
  }

  console.log("Getting the migration data...")
  const [ownersWithCls, clMigrationData] = await getAllMigrationData(existingPoolAddress)
  assertNonNullable(ownersWithCls)
  const chunkedOwnersWithCls = _.chunk(ownersWithCls, 5)
  const chunkedClMigrationData = _.chunk(clMigrationData, 5)
  let migrationEvents
  const migrationTxs: any[] = []
  if (ownersWithCls.length > 0) {
    for (let i = 0; i < chunkedOwnersWithCls.length; i++) {
      const ownerChunk = chunkedOwnersWithCls[i]
      // @ts-expect-error Broken because V2Migrator contract has been removed.
      const migrationTxChunk = await migrator.migrateCreditLines(
        goldfinchConfig.address,
        ownerChunk,
        chunkedClMigrationData[i]
      )
      migrationTxs.push(migrationTxChunk)
    }
    migrationEvents = extractAllMigrationEvents(migrationTxs, migrator)
  }
  console.log("Adding everyone to the goList...")
  await addEveryoneToTheGoList(goldfinchConfig.address, migrator)
  console.log("Closing out the migration...")
  await closingOutTheMigration(goldfinchConfig.address, migrator)
  console.log("All done!")
  return migrationEvents
}

async function closingOutTheMigration(goldfinchConfigAddress, migrator) {
  return migrator.closeOutMigration(goldfinchConfigAddress)
}

async function addEveryoneToTheGoList(goldfinchConfigAddress, migrator) {
  const chunkedGoList = _.chunk(goList, 375)
  const config = await getTruffleContract("GoldfinchConfig")
  for (let i = 0; i < chunkedGoList.length; i++) {
    console.log("Trying adding chunk", i, "to the goList")
    const chunk = chunkedGoList[i]
    assertNonNullable(chunk)
    const alreadyAdded = await (config as any).goList(chunk[0])
    if (!alreadyAdded) {
      console.log("Actually adding chunk", i, "to the goList")
      await migrator.bulkAddToGoList(goldfinchConfigAddress, chunk)
    }
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

async function getAllMigrationData(pool): Promise<[Array<[string, any]>, string[][]]> {
  const ownerClData: Array<[string, any]> = []
  const migrationData: string[][] = []
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  await Promise.all(
    Object.entries(asNonNullable(borrowerCreditlines[chainId])).map(async ([cl, clData]) => {
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
  assertNonNullable(gf_deployer)
  const protocolOwner = await getProtocolOwner()
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  assertIsChainId(chainId)
  const deployer = new ContractDeployer(console.log, hre)
  const existingContracts = await getExistingContracts(contractsToUpgrade, gf_deployer, chainId)
  const upgradedContracts = await upgradeContracts(
    contractsToUpgrade,
    // @ts-expect-error Broken because function signature is obsolete.
    existingContracts,
    gf_deployer,
    gf_deployer,
    deployer,
    false
  )
  const newConfig: any = await getTruffleContract("GoldfinchConfig", {from: gf_deployer})
  // Set the deployer, governance, and migrator as owners of the config. This gets revoked later.
  if (!(await newConfig.hasRole(GO_LISTER_ROLE, migrator.address))) {
    console.log("Initializing the new config...")
    await newConfig.initialize(gf_deployer)
    console.log("initializing from other config...")
    await newConfig.initializeFromOtherConfig(asNonNullable(existingContracts.GoldfinchConfig).ExistingContract.address)
    console.log("Granting roles...")
    await newConfig.grantRole(OWNER_ROLE, protocolOwner)
    await newConfig.grantRole(PAUSER_ROLE, protocolOwner)
    await newConfig.grantRole(GO_LISTER_ROLE, protocolOwner)
    await newConfig.grantRole(OWNER_ROLE, migrator.address)
    await newConfig.grantRole(PAUSER_ROLE, migrator.address)
    await newConfig.grantRole(GO_LISTER_ROLE, migrator.address)
    console.log("Done granting roles...")
  } else {
    console.log("Config already initialized...")
  }
  console.log("Deploying the V2 contracts...")
  await deployV2(upgradedContracts, {noFidu: true})
  return {
    pool: asNonNullable(upgradedContracts.Pool).UpgradedImplAddress,
    creditDesk: asNonNullable(upgradedContracts.CreditDesk).UpgradedImplAddress,
    fidu: asNonNullable(upgradedContracts.Fidu).UpgradedImplAddress,
    goldfinchFactory: asNonNullable(upgradedContracts.GoldfinchFactory).UpgradedImplAddress,
    goldfinchConfig: newConfig.address,
    gf_deployer: gf_deployer,
    existingPool: asNonNullable(existingContracts.Pool).ExistingContract.address,
  }
}

async function givePermsToMigrator({pool, creditDesk, goldfinchFactory, fidu, migrator, oldConfig}) {
  // Give owner roles to the migrator
  if (isMainnetForking()) {
    await fidu.grantRole(MINTER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})
    await fidu.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})
    await fidu.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})

    await creditDesk.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})
    await creditDesk.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})

    await pool.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})
    await pool.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})

    await goldfinchFactory.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})
    await goldfinchFactory.grantRole(PAUSER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})

    await oldConfig.grantRole(OWNER_ROLE, migrator.address, {from: MAINNET_GOVERNANCE_MULTISIG})
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

async function upgradeImplementations(
  migrator,
  configAddress,
  newDeployments,
  {pool, creditDesk, fidu, goldfinchFactory}
) {
  const protocolOwner = await getProtocolOwner()
  if (isMainnetForking()) {
    const iMigrate = artifacts.require("IMigrate")
    await (await iMigrate.at(pool.address)).changeImplementation(newDeployments[0], "0x", {from: protocolOwner})
    await (await iMigrate.at(creditDesk.address)).changeImplementation(newDeployments[1], "0x", {from: protocolOwner})
    await (await iMigrate.at(fidu.address)).changeImplementation(newDeployments[2], "0x", {from: protocolOwner})
    await (
      await iMigrate.at(goldfinchFactory.address)
    ).changeImplementation(newDeployments[3], "0x", {from: protocolOwner})
  } else {
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
  const migrator = await getTruffleContract("V2Migrator", {from: gf_deployer})
  // @ts-expect-error Broken because V2Migrator contract has been removed.
  if (!(await migrator.hasRole(OWNER_ROLE, protocolOwner))) {
    console.log("Initializing the migrator...")
    // @ts-expect-error Broken because V2Migrator contract has been removed.
    await migrator.initialize(gf_deployer, config.address)
    // @ts-expect-error Broken because V2Migrator contract has been removed.
    await migrator.grantRole(OWNER_ROLE, protocolOwner)
  }
  console.log("Done deploying the migrator...")
  return migrator
}

// Leaving this commented out because it will be useful after
// gnosis fixes their library. Didn't want to have to re-discover all this.
// Also, this file will basically never be used again, so it seemed find to keep it
// here since it won't be bothering the daily developer.

// Usage:
/*
  const ethersMigrator = await getContract("V2Migrator", {as: "ethers"})
  const tx = {
    to: migrator.address,
    value: "0",
    data: ethersMigrator.interface.encodeFunctionData("upgradeImplementations", [configAddress, newDeployments]),
  }
  await delegateSafeTransaction(tx)
*/

// async function delegateSafeTransaction(tx) {
//   const safeAddress = MAINNET_GOVERNANCE_MULTISIG
//   const blakesGovAddress = "0xf13eFa505444D09E176d83A4dfd50d10E399cFd5"
//   const mikesGovAddress = "0x5E7b1B5d5B03558BA57410e5dc4DbFCA71C92B84"
//   await impersonateAccount(hre, blakesGovAddress)
//   await impersonateAccount(hre, mikesGovAddress)
//   let ownerSigner = await ethers.getSigner(blakesGovAddress)
//   let ownerSigner2 = await ethers.getSigner(mikesGovAddress)
//   const ethAdapterOwner1 = new EthersAdapter({ethers, signer: ownerSigner})
//   const ethAdapterOwner2 = new EthersAdapter({ethers, signer: ownerSigner2})
//   const safeSdk = await Safe.create({
//     ethAdapter: ethAdapterOwner1,
//     safeAddress,
//     contractNetworks: {
//       31337: {
//         multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
//         safeMasterCopyAddress: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
//         safeProxyFactoryAddress: "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
//       },
//       1: {
//         multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
//         safeMasterCopyAddress: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
//         safeProxyFactoryAddress: "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
//       },
//       4: {
//         multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
//         safeMasterCopyAddress: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
//         safeProxyFactoryAddress: "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
//       },
//     },
//   })
//   const owner2 = await safeSdk.connect({ethAdapter: ethAdapterOwner2, safeAddress})
//   tx.operation = 1
//   const transactions = [tx]

//   const safeTx = await safeSdk.createTransaction(...transactions)
//   safeTx.data.maxFeePerGas = 114026667 * 2
//   const txHash = await owner2.getTransactionHash(safeTx)
//   const approveTx = await owner2.approveTransactionHash(txHash)
//   await approveTx.transactionResponse.wait()
//   const executeTxResponse = await safeSdk.executeTransaction(safeTx)
//   const res = await executeTxResponse.transactionResponse.wait()
//   const executionResult = _.last(res.events)
//   if (executionResult.event === "ExecutionFailure") {
//     console.log("res:", res)
//     throw new Error("Delegation failed")
//   } else if (executionResult.event === "ExecutionSuccess") {
//     console.log("Delegation successful!")
//   } else {
//     console.log("res:", res)
//     throw new Error("Unexpected state. Did not detect either success or failure")
//   }
// }

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export {deployMigrator, givePermsToMigrator, deployAndMigrateToV2, handleNewDeployments, prepareMigration}
