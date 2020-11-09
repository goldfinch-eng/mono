const {BN, expect} = require("./testHelpers.js")
const hre = require("hardhat")
const {deployments, getNamedAccounts, ethers} = hre
const {
  upgrade,
  getDeployedContract,
  fromAtomic,
  toAtomic,
  OWNER_ROLE,
  CONFIG_KEYS,
  USDCDecimals,
  ETHDecimals,
} = require("../blockchain_scripts/deployHelpers")
const baseDeploy = require("../blockchain_scripts/baseDeploy")
const updateConfigs = require("../blockchain_scripts/updateConfigs")

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

    it("deploys the credit line and credit line factory correctly", async () => {
      const creditLine = await deployments.get("CreditLine")
      const creditLineFactory = await deployments.get("CreditLineFactory")
      expect(creditLine.address).to.exist
      expect(creditLineFactory.address).to.exist

      const config = await getDeployedContract(deployments, "TestGoldfinchConfig")
      expect(await config.getAddress(CONFIG_KEYS.CreditLineImplementation)).to.equal(creditLine.address)
      expect(await config.getAddress(CONFIG_KEYS.CreditLineFactory)).to.equal(creditLineFactory.address)
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
      const creditLine = await getDeployedContract(deployments, "CreditLine")
      const creditLineFactory = await getDeployedContract(deployments, "CreditLineFactory")
      const goldfinchConfig = await getDeployedContract(deployments, "TestGoldfinchConfig")

      expect(String(await goldfinchConfig.getNumber(CONFIG_KEYS.TransactionLimit))).to.bignumber.gt(new BN(0))
      expect(String(await goldfinchConfig.getNumber(CONFIG_KEYS.TotalFundsLimit))).to.bignumber.gt(new BN(0))
      expect(String(await goldfinchConfig.getNumber(CONFIG_KEYS.MaxUnderwriterLimit))).to.bignumber.gt(new BN(0))
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CreditLineImplementation)).to.equal(creditLine.address)
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CreditLineFactory)).to.equal(creditLineFactory.address)
    })
  })

  describe("Setup for Testing", () => {
    it("should not fail", async () => {
      return expect(deployments.run("setup_for_testing")).to.be.fulfilled
    })
    it("should create an underwriter credit line for the protocol_owner", async () => {
      const {protocol_owner} = await getNamedAccounts()
      await deployments.run("setup_for_testing")
      const creditDesk = await getDeployedContract(deployments, "TestCreditDesk")
      const result = await creditDesk.getUnderwriterCreditLines(protocol_owner)
      expect(result.length).to.equal(1)
    })
  })

  describe("Upgrading", () => {
    beforeEach(async () => {
      await deployments.fixture()
    })
    it("should allow for upgrading the logic", async () => {
      const {proxy_owner} = await getNamedAccounts()
      const creditDesk = await getDeployedContract(deployments, "TestCreditDesk")
      expect(typeof creditDesk.someBrandNewFunction).not.to.equal("function")

      await upgrade(deployments.deploy, "TestCreditDesk", proxy_owner, {contract: "FakeV2CreditDesk"})
      const newCreditDesk = await getDeployedContract(deployments, "TestCreditDesk")

      expect(typeof newCreditDesk.someBrandNewFunction).to.equal("function")
      const result = String(await newCreditDesk.someBrandNewFunction())
      expect(result).to.bignumber.equal(new BN(5))
    })

    describe("upgrading credit lines", async () => {
      it("should upgrade the credit line", async () => {
        const {proxy_owner, protocol_owner} = await getNamedAccounts()

        const creditDesk = await getDeployedContract(deployments, "TestCreditDesk")
        const config = await getDeployedContract(deployments, "TestGoldfinchConfig")

        // Ensure existing credit line is the old version
        let creditLines = await creditDesk.getUnderwriterCreditLines(protocol_owner)
        expect(creditLines.length).to.equal(1)
        const originalCreditLine = await ethers.getContractAt("CreditLine", creditLines[0])
        expect(typeof originalCreditLine.anotherNewFunction).not.to.equal("function")

        // Deploy new credit line and update the factory to use it
        const newCreditLineImpl = await deployments.deploy("CreditLine", {
          from: proxy_owner,
          contract: "FakeV2CreditLine",
        })
        await (await config.setCreditLineImplementation(newCreditLineImpl.address)).wait()

        // Create a new credit line
        await creditDesk.createCreditLine(
          protocol_owner,
          String(new BN(10000).mul(USDCDecimals)), //Limit
          String(new BN(5).mul(ETHDecimals).div(new BN(100))), //Interest
          String(new BN(30)), // Payment period
          String(new BN(123)) // Term
        )

        creditLines = await creditDesk.getUnderwriterCreditLines(protocol_owner)
        expect(creditLines.length).to.equal(2)

        //Original credit line unaffected
        const originalCreditLineAfterUpgrade = await ethers.getContractAt("CreditLine", creditLines[0])
        expect(originalCreditLine.address).to.equal(originalCreditLineAfterUpgrade.address)
        expect(typeof originalCreditLineAfterUpgrade.anotherNewFunction).not.to.equal("function")
        expect(String(await originalCreditLineAfterUpgrade.termInDays())).to.equal("360")

        const newCreditLine = await ethers.getContractAt("FakeV2CreditLine", creditLines[1])
        expect(originalCreditLineAfterUpgrade.address).to.not.equal(newCreditLine.address)
        expect(String(await newCreditLine.termInDays())).to.equal("123")
        expect(typeof newCreditLine.anotherNewFunction).to.equal("function")
        expect(String(await newCreditLine.anotherNewFunction())).to.equal("42")
      })
    })

    it("should not change data after an upgrade", async () => {
      //If this test fails, it usually means that the data layout changed between the credit desk
      //and the FakeCreditDesk. Check the order of the variables.
      const {protocol_owner, proxy_owner} = await getNamedAccounts()
      const creditDesk = await getDeployedContract(deployments, "TestCreditDesk")
      const originalResult = await creditDesk.getUnderwriterCreditLines(protocol_owner)

      await upgrade(deployments.deploy, "TestCreditDesk", proxy_owner, {contract: "FakeV2CreditDesk"})
      const newCreditDesk = await getDeployedContract(deployments, "TestCreditDesk")

      const newResult = await newCreditDesk.getUnderwriterCreditLines(protocol_owner)
      expect(originalResult).to.deep.equal(newResult)
    })

    it("should allow you to change the owner of the implementation, without affecting the owner of the proxy", async () => {
      const creditDesk = await getDeployedContract(deployments, "CreditDesk")
      const someWallet = ethers.Wallet.createRandom()

      const originally = await creditDesk.hasRole(OWNER_ROLE, someWallet.address)
      expect(originally).to.be.false

      await creditDesk.grantRole(OWNER_ROLE, someWallet.address)

      const afterGrant = await creditDesk.hasRole(OWNER_ROLE, someWallet.address)
      expect(afterGrant).to.be.true
    })

    it("should allow for a way to transfer ownership of the proxy", async () => {
      const {protocol_owner, proxy_owner} = await getNamedAccounts()
      const creditDeskProxy = await getDeployedContract(deployments, "CreditDesk_Proxy", proxy_owner)

      const originalOwner = await creditDeskProxy.owner()
      expect(originalOwner).to.equal(proxy_owner)

      const result = await creditDeskProxy.transferOwnership(protocol_owner)
      await result.wait()

      const newOwner = await creditDeskProxy.owner()
      expect(newOwner).to.equal(protocol_owner)
    })
  })

  describe("Upgrading the whole protocol", async () => {
    beforeEach(async () => {
      await deployments.fixture()
    })
    it("should not fail", async () => {
      return expect(baseDeploy(hre, {shouldUpgrade: true})).to.be.fulfilled
    })
  })

  describe("Updating configs", async () => {
    beforeEach(async () => {
      await deployments.fixture()
    })

    it("Should update protocol configs", async () => {
      const {protocol_owner} = await getNamedAccounts()
      let underwriter = protocol_owner
      const creditDesk = await getDeployedContract(deployments, "CreditDesk")
      const config = await getDeployedContract(deployments, "TestGoldfinchConfig")

      const new_config = {
        totalFundsLimit: 2000,
        transactionLimit: 1000,
        maxUnderwriterLimit: 2000,
      }

      await expect(creditDesk.setUnderwriterGovernanceLimit(underwriter, toAtomic(24000))).to.be.fulfilled

      await updateConfigs(hre, new_config)

      await expect(creditDesk.setUnderwriterGovernanceLimit(underwriter, toAtomic(24000))).to.be.rejectedWith(
        /greater than the max allowed/
      )

      expect(fromAtomic(await config.getNumber(CONFIG_KEYS.TotalFundsLimit))).to.bignumber.eq(
        new BN(new_config["totalFundsLimit"])
      )
      expect(fromAtomic(await config.getNumber(CONFIG_KEYS.TransactionLimit))).to.bignumber.eq(
        new BN(new_config["transactionLimit"])
      )
      expect(fromAtomic(await config.getNumber(CONFIG_KEYS.MaxUnderwriterLimit))).to.bignumber.eq(
        new BN(new_config["maxUnderwriterLimit"])
      )
    })
  })
})
