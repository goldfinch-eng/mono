/* global web3 */
const hre = require("hardhat")
import {advanceTime, expect, expectAction, toTruffle} from "../testHelpers"
import {isMainnetForking, getSignerForAddress, OWNER_ROLE, MINTER_ROLE, getContract} from "../../blockchain_scripts/deployHelpers"
const {deployments, artifacts, ethers} = hre
const {deployMigrator, givePermsToMigrator, deployAndMigrateToV2} = require("../../blockchain_scripts/v2/migrate")
const TEST_TIMEOUT = 180000 // 3 mins
import {getMainnetTruffleContracts, impersonateAccount, MAINNET_MULTISIG, MAINNET_UNDERWRITER} from "../../blockchain_scripts/mainnetForkingHelpers"
import BN from "bn.js"
import _ from "lodash"

describe("Migrating to V2", () => {
  // Hack way to only run this suite when we actually want to.
  if (!isMainnetForking()) {
    return
  }

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    // Note: base_deploy always returns when mainnet forking, however
    // we need it here, because the "fixture" part is what let's hardhat
    // snapshot and give us a clean blockchain before each test.
    // Otherewise, we have state leaking across tests.
    await deployments.fixture("base_deploy")
    const {gf_deployer} = await getNamedAccounts()
    mainnetContracts = await getMainnetTruffleContracts()
    const config = mainnetContracts.GoldfinchConfig
    const pool = mainnetContracts.Pool
    const creditDesk = mainnetContracts.CreditDesk
    const goldfinchConfig = mainnetContracts.GoldfinchConfig
    const goldfinchFactory = mainnetContracts.GoldfinchFactory
    const fidu = mainnetContracts.Fidu

    let migrator = await deployMigrator(hre, {config})
    migrator = await toTruffle(migrator, "V2Migrator", {from: gf_deployer})
    return {migrator, pool, creditDesk, goldfinchConfig, goldfinchFactory, fidu}
  })

  let owner, person2, migrator, accounts, mainnetContracts, mainnetMultisigSigner, bwr
  let pool, creditDesk, goldfinchFactory, goldfinchConfig, fidu

  beforeEach(async function () {
    this.timeout(TEST_TIMEOUT)
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, person2] = accounts

    ;({migrator, pool, creditDesk, goldfinchConfig, goldfinchFactory, fidu} = await testSetup())

    ;[owner, bwr] = await web3.eth.getAccounts()

    mainnetContracts = await getMainnetTruffleContracts()
    mainnetMultisigSigner = await ethers.provider.getSigner(MAINNET_MULTISIG)

    // Ensure the multisig has funds for upgrades and other transactions
    let ownerAccount = await getSignerForAddress(owner)
    await ownerAccount!.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("5.0")})

    // Ensure mainnet underwriter has funds for transactions
    await ownerAccount!.sendTransaction({to: MAINNET_UNDERWRITER, value: ethers.utils.parseEther("5.0")})

    await impersonateAccount(hre, MAINNET_MULTISIG)
  })

  async function getProxyVersion(address) {
    return await artifacts.require("IBase").at(address)
  }

  async function assertNewClStillCalculatesInterestCorrectly(tranchedPool, newCl, expectedAmount) {
    await tranchedPool.assess()
    const afterNextDueTime = (await newCl.nextDueTime()).add(new BN(1))
    await advanceTime({toSecond: afterNextDueTime})
    await expectAction(() => tranchedPool.assess()).toChange([
      [() => newCl.totalInterestAccrued(), {by: new BN(expectedAmount)}], // A period's worth of interest
      [() => newCl.principalOwed(), {by: new BN(0)}],
    ])
  }

  type MigratedInfo = {
    tranchedPool: Truffle.ContractInstance,
    newCl: Truffle.ContractInstance
  }
  async function getMigratedInfo(clAddress: string, migrationEvents) : Promise<MigratedInfo> {
    const event = _.find(migrationEvents, (e) => e.args.clToMigrate.toLowerCase() === clAddress.toLowerCase())

    return {
      tranchedPool: await getContract("MigratedTranchedPool", {at: event.args.tranchedPool}),
      newCl: await getContract("CreditLine", {at: event.args.newCl})
    }
  }

  describe("givePermsToMigrator", async function () {
    it("should give all the perms to the migrator address", async () => {
      // Ensure we don't currently have the right perms
      expect(await pool.hasRole(OWNER_ROLE, migrator.address)).to.equal(false)
      expect(await creditDesk.hasRole(OWNER_ROLE, migrator.address)).to.equal(false)
      expect(await goldfinchFactory.hasRole(OWNER_ROLE, migrator.address)).to.equal(false)
      expect(await fidu.hasRole(MINTER_ROLE, migrator.address)).to.equal(false)
      expect(await goldfinchConfig.hasRole(OWNER_ROLE, migrator.address)).to.equal(false)

      await givePermsToMigrator({pool, creditDesk, goldfinchFactory, fidu, migrator, oldConfig: goldfinchConfig})

      // Adding new owner worked
      expect(await pool.hasRole(OWNER_ROLE, migrator.address)).to.equal(true)
      expect(await creditDesk.hasRole(OWNER_ROLE, migrator.address)).to.equal(true)
      expect(await goldfinchFactory.hasRole(OWNER_ROLE, migrator.address)).to.equal(true)
      expect(await fidu.hasRole(MINTER_ROLE, migrator.address)).to.equal(true)
      expect(await goldfinchConfig.hasRole(OWNER_ROLE, migrator.address)).to.equal(true)

      // Proxy ownership change worked
      expect(await (await getProxyVersion(pool.address)).owner()).to.equal(migrator.address)
      expect(await (await getProxyVersion(creditDesk.address)).owner()).to.equal(migrator.address)
      expect(await (await getProxyVersion(goldfinchFactory.address)).owner()).to.equal(migrator.address)
      expect(await (await getProxyVersion(fidu.address)).owner()).to.equal(migrator.address)
    }).timeout(TEST_TIMEOUT)
  })
  describe("step 1", async function () {
    it("should do lots of stuff", async () => {
      await givePermsToMigrator({pool, creditDesk, goldfinchFactory, fidu, migrator, oldConfig: goldfinchConfig})
      const migrationEvents = await deployAndMigrateToV2(migrator)

      expect(await pool.paused()).to.eq(true)


      // QuickCheck's 300k creditline
      let {tranchedPool, newCl} = await getMigratedInfo("0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED", migrationEvents)
      // This value taken from the exact current amount of "interestOwed", according to etherscan
      let expectedAmount = 3698625354
      await assertNewClStillCalculatesInterestCorrectly(tranchedPool, newCl, expectedAmount)

      const {tranchedPool: tranchedPool2, newCl: newCl2} = await getMigratedInfo("0xb2ad56df3bce9bad4d8f04be1fc0eda982a84f44", migrationEvents)
      // This value taken from the exact current amount of "interestOwed", according to etherscan
      // except divided by 2, because at the time, Aspire happened to have accrued 2 periods worth of interest.
      expectedAmount = 2958904109
      await assertNewClStillCalculatesInterestCorrectly(tranchedPool2, newCl2, expectedAmount)
    }).timeout(TEST_TIMEOUT)
  })
})
