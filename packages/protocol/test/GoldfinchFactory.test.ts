import {deployments} from "hardhat"
import {getDeployedAsTruffleContract, usdcVal} from "./testHelpers"
import {expectEvent} from "@openzeppelin/test-helpers"
import {GoldfinchFactoryInstance, GoldfinchConfigInstance} from "../typechain/truffle"
import {interestAprAsBN} from "../blockchain_scripts/deployHelpers"
import {BN} from "ethereumjs-util"
import {deployBaseFixture} from "./util/fixtures"

describe("GoldfinchFactory", async () => {
  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const {goldfinchFactory, goldfinchConfig, ...deployed} = await deployBaseFixture()
    const [owner, borrower, otherPerson] = await web3.eth.getAccounts()
    const borrowerRole = await goldfinchFactory.BORROWER_ROLE()
    await goldfinchFactory.grantRole(borrowerRole, borrower as string, {from: owner})
    return {
      goldfinchFactory,
      goldfinchConfig,
      owner: owner as string,
      borrower: borrower as string,
      otherPerson: otherPerson as string,
      ...deployed,
    }
  })

  let owner: string
  let otherPerson: string
  let borrower: string
  let goldfinchFactory: GoldfinchFactoryInstance
  let goldfinchConfig: GoldfinchConfigInstance
  beforeEach(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, otherPerson, borrower, goldfinchConfig, goldfinchFactory} = await testSetup())
  })

  describe("createPool", () => {
    const juniorFeePercent = new BN(20)
    const limit = usdcVal(5000)
    const interestApr = interestAprAsBN("0.05")
    const paymentPeriodInDays = new BN("30")
    const principalGracePeriod = new BN("30")
    const termInDays = new BN("360")
    const lateFeeApr = new BN("0")
    const fundableAt = new BN("0")
    const allowedUIDTypes = []

    it("user with admin role can call", async () => {
      const caller = owner
      const adminRole = await goldfinchFactory.OWNER_ROLE()

      expect(await goldfinchFactory.hasRole(adminRole, caller)).to.be.true

      const tx = await goldfinchFactory.createPool(
        borrower,
        juniorFeePercent,
        limit,
        interestApr,
        paymentPeriodInDays,
        termInDays,
        lateFeeApr,
        principalGracePeriod,
        fundableAt,
        allowedUIDTypes,
        {from: caller}
      )

      expectEvent(tx, "PoolCreated")
    })

    it("user with borrower role can call", async () => {
      const caller = borrower
      const borrowerRole = await goldfinchFactory.BORROWER_ROLE()

      expect(await goldfinchFactory.hasRole(borrowerRole, caller)).to.be.true

      const tx = await goldfinchFactory.createPool(
        borrower,
        juniorFeePercent,
        limit,
        interestApr,
        paymentPeriodInDays,
        termInDays,
        lateFeeApr,
        principalGracePeriod,
        fundableAt,
        allowedUIDTypes,
        {from: caller}
      )

      expectEvent(tx, "PoolCreated")
    })

    it("users without the admin or borrower role cannot create a pool", async () => {
      const caller = otherPerson
      const borrowerRole = await goldfinchFactory.BORROWER_ROLE()
      const adminRole = await goldfinchFactory.OWNER_ROLE()

      expect(await goldfinchFactory.hasRole(borrowerRole, caller)).to.be.false
      expect(await goldfinchFactory.hasRole(adminRole, caller), borrower).to.be.false

      expect(
        goldfinchFactory.createPool(
          borrower,
          juniorFeePercent,
          limit,
          interestApr,
          paymentPeriodInDays,
          termInDays,
          lateFeeApr,
          principalGracePeriod,
          fundableAt,
          allowedUIDTypes,
          {from: caller}
        )
      ).to.be.rejectedWith(/Must have admin or borrower role to perform this action/i)
    })
  })

  describe("grantRole", async () => {
    it("owner can grant borrower role", async () => {
      const borrowerRole = await goldfinchFactory.BORROWER_ROLE()
      await goldfinchFactory.grantRole(borrowerRole, otherPerson, {from: owner})
      expect(await goldfinchFactory.hasRole(borrowerRole, otherPerson)).to.be.true
    })

    it("others cannot grant borrower role", async () => {
      const borrowerRole = await goldfinchFactory.BORROWER_ROLE()
      expect(goldfinchFactory.grantRole(borrowerRole, otherPerson, {from: otherPerson})).to.be.rejectedWith(
        /AccessControl: sender must be an admin to grant/i
      )
      expect(await goldfinchFactory.hasRole(borrowerRole, otherPerson)).to.be.false
    })
  })

  describe("performUgrade", async () => {
    const performUpgradeSetup = deployments.createFixture(async () => {
      const {goldfinchFactory, ...others} = await testSetup()
      await goldfinchFactory.performUpgrade({from: owner})
      return {goldfinchFactory, ...others}
    })

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({goldfinchFactory} = await performUpgradeSetup())
    })

    it("makes OWNER_ROLE admin of BORROWER_ROLE", async () => {
      const borrowerRole = await goldfinchFactory.BORROWER_ROLE()
      const ownerRole = await goldfinchFactory.OWNER_ROLE()

      expect(await goldfinchFactory.getRoleAdmin(borrowerRole)).to.eq(ownerRole)
    })
  })

  describe("updateGoldfinchConfig", async () => {
    describe("setting it", async () => {
      it("emits an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})
        await goldfinchConfig.setGoldfinchConfig(newConfig.address, {from: owner})
        const tx = await goldfinchFactory.updateGoldfinchConfig({from: owner})
        expectEvent(tx, "GoldfinchConfigUpdated", {
          who: owner,
          configAddress: newConfig.address,
        })
      })
    })
  })
})
