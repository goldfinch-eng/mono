import {BN, expect} from "./testHelpers"
import hre from "hardhat"
const {deployments, getNamedAccounts, ethers} = hre
import {getDeployedContract, fromAtomic, OWNER_ROLE} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import updateConfigs from "../blockchain_scripts/updateConfigs"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {GoldfinchFactory} from "../typechain/ethers"

const TEST_TIMEOUT = 30000

describe("Deployment", async () => {
  describe("Base Deployment", () => {
    beforeEach(async () => {
      await deployments.fixture("base_deploy")
    })
    it("deploys the pool", async () => {
      const pool = await deployments.get("TestPool")
      expect(pool.address).to.exist
    })
    it("deploys a proxy for the pool as well", async () => {
      const poolProxy = await deployments.getOrNull("TestPool_Proxy")
      expect(poolProxy).to.exist
    })

    it("should set the protocol owner to the treasury reserve", async () => {
      const {protocol_owner} = await getNamedAccounts()
      const config = await getDeployedContract(deployments, "TestGoldfinchConfig")
      expect(await config.getAddress(CONFIG_KEYS.TreasuryReserve)).to.equal(protocol_owner)
    })
    it("deploys the credit desk", async () => {
      const creditDesk = await deployments.get("TestCreditDesk")
      expect(creditDesk.address).to.exist
    })
    it("deploys a proxy for the credit desk as well", async () => {
      const creditDeskProxy = await deployments.getOrNull("TestCreditDesk_Proxy")
      expect(creditDeskProxy).to.exist
    })
    it("sets the credit desk as the owner of the pool", async () => {
      const creditDesk = await deployments.get("TestCreditDesk")
      const pool = await getDeployedContract(deployments, "TestPool")
      expect(await pool.hasRole(OWNER_ROLE, creditDesk.address)).to.be.true
    })
    it("sets the right defaults", async () => {
      const goldfinchFactory = await getDeployedContract(deployments, "GoldfinchFactory")
      const goldfinchConfig = await getDeployedContract(deployments, "TestGoldfinchConfig")

      expect(String(await goldfinchConfig.getNumber(CONFIG_KEYS.TransactionLimit))).to.bignumber.gt(new BN(0))
      expect(String(await goldfinchConfig.getNumber(CONFIG_KEYS.TotalFundsLimit))).to.bignumber.gt(new BN(0))
      expect(String(await goldfinchConfig.getNumber(CONFIG_KEYS.MaxUnderwriterLimit))).to.bignumber.gt(new BN(0))
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.GoldfinchFactory)).to.equal(goldfinchFactory.address)
    })
  })

  describe("Setup for Testing", function () {
    this.timeout(TEST_TIMEOUT)

    it("should not fail", async () => {
      return expect(deployments.run("setup_for_testing")).to.be.fulfilled
    })
    it("should create borrower contract and tranched pool", async () => {
      await deployments.run("setup_for_testing")
      const goldfinchFactory = await getDeployedContract<GoldfinchFactory>(deployments, "GoldfinchFactory")
      const borrowerCreated = await goldfinchFactory.queryFilter(goldfinchFactory.filters.BorrowerCreated())
      expect(borrowerCreated.length).to.equal(1)
      const event = borrowerCreated[0]
      assertNonNullable(event)
      const borrowerConAddr = event.args.borrower
      const result = await goldfinchFactory.queryFilter(goldfinchFactory.filters.PoolCreated(null, borrowerConAddr))
      expect(result.length).to.equal(2)
    })
  })

  describe("Upgrading", () => {
    beforeEach(async () => {
      await deployments.fixture()
    })

    it("should allow you to change the owner of the implementation, without affecting the owner of the proxy", async () => {
      const seniorPool = await getDeployedContract(deployments, "SeniorPool")
      const someWallet = ethers.Wallet.createRandom()

      const originally = await seniorPool.hasRole(OWNER_ROLE, someWallet.address)
      expect(originally).to.be.false

      await seniorPool.grantRole(OWNER_ROLE, someWallet.address)

      const afterGrant = await seniorPool.hasRole(OWNER_ROLE, someWallet.address)
      expect(afterGrant).to.be.true
    })

    it("should allow for a way to transfer ownership of the proxy", async () => {
      const {protocol_owner, gf_deployer} = await getNamedAccounts()
      const seniorPoolProxy = await getDeployedContract(deployments, "SeniorPool_Proxy", protocol_owner)

      const originalOwner = await seniorPoolProxy.owner()
      expect(originalOwner).to.equal(protocol_owner)

      const result = await seniorPoolProxy.transferOwnership(gf_deployer)
      await result.wait()
      const newOwner = await seniorPoolProxy.owner()
      expect(newOwner).to.equal(gf_deployer)
    })
  })

  describe("Updating configs", async () => {
    beforeEach(async () => {
      await deployments.fixture()
    })

    it("Should update protocol configs", async () => {
      const config = await getDeployedContract(deployments, "TestGoldfinchConfig")

      const new_config = {
        totalFundsLimit: 2000,
        transactionLimit: 1000,
        maxUnderwriterLimit: 2000,
        reserveDenominator: 11,
        withdrawFeeDenominator: 202,
        latenessGracePeriod: 9,
        latenessMaxDays: 6,
        drawdownPeriodInSeconds: 11000,
        transferRestrictionPeriodInDays: 180,
        leverageRatio: String(17e18),
      }

      await updateConfigs(hre, new_config)

      expect(fromAtomic(await config.getNumber(CONFIG_KEYS.TotalFundsLimit))).to.bignumber.eq(
        new BN(new_config["totalFundsLimit"])
      )
      expect(fromAtomic(await config.getNumber(CONFIG_KEYS.TransactionLimit))).to.bignumber.eq(
        new BN(new_config["transactionLimit"])
      )
      expect(fromAtomic(await config.getNumber(CONFIG_KEYS.MaxUnderwriterLimit))).to.bignumber.eq(
        new BN(new_config["maxUnderwriterLimit"])
      )

      expect(String(await config.getNumber(CONFIG_KEYS.ReserveDenominator))).to.eq(
        String(new_config["reserveDenominator"])
      )
      expect(String(await config.getNumber(CONFIG_KEYS.WithdrawFeeDenominator))).to.eq(
        String(new_config["withdrawFeeDenominator"])
      )
      expect(String(await config.getNumber(CONFIG_KEYS.LatenessGracePeriodInDays))).to.eq(
        String(new_config["latenessGracePeriod"])
      )
      expect(String(await config.getNumber(CONFIG_KEYS.LatenessMaxDays))).to.eq(String(new_config["latenessMaxDays"]))
      expect(String(await config.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds))).to.eq(
        String(new_config["drawdownPeriodInSeconds"])
      )
      expect(String(await config.getNumber(CONFIG_KEYS.TransferPeriodRestrictionInDays))).to.eq(
        String(new_config["transferRestrictionPeriodInDays"])
      )
      expect(String(await config.getNumber(CONFIG_KEYS.LeverageRatio))).to.eq(String(new_config["leverageRatio"]))
    })
  })
})
