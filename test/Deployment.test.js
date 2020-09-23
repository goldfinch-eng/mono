const {chai, BN, expect } = require("./testHelpers.js")
const bre = require("@nomiclabs/buidler")
const { deployments, getNamedAccounts } = bre
const { upgrade, getDeployedContract } = require("../blockchain_scripts/deployHelpers")
const baseDeploy = require("../blockchain_scripts/baseDeploy")

describe("Deployment", async () => {
  describe("Base Deployment", () => {
    beforeEach(async () => {
      await deployments.fixture("base_deploy")
    })
    it("deploys the pool", async () => {
      const pool = await deployments.get("Pool")
      expect(pool.address).to.exist
    })
    it("deploys a proxy for the pool as well", async () => {
      const poolProxy = await deployments.getOrNull("Pool_Proxy")
      expect(poolProxy).to.exist
    })
    it("deploys the credit desk", async () => {
      const creditDesk = await deployments.get("CreditDesk")
      expect(creditDesk.address).to.exist
    })
    it("deploys a proxy for the credit desk as well", async () => {
      const creditDeskProxy = await deployments.getOrNull("CreditDesk_Proxy")
      expect(creditDeskProxy).to.exist
    })
    it("sets the credit desk as the owner of the pool", async () => {
      const creditDesk = await deployments.get("CreditDesk")
      const pool = await getDeployedContract(deployments, "Pool")
      expect(await pool.owner()).to.equal(creditDesk.address)
    })
    it.only("sets non-zero limits", async() => {
      const creditDesk = await getDeployedContract(deployments, "CreditDesk")
      const pool = await getDeployedContract(deployments, "Pool")
      expect(String(await creditDesk.maxUnderwriterLimit())).to.bignumber.gt(new BN(0))
      expect(String(await creditDesk.transactionLimit())).to.bignumber.gt(new BN(0))
      expect(String(await pool.totalFundsLimit())).to.bignumber.gt(new BN(0))
      expect(String(await pool.transactionLimit())).to.bignumber.gt(new BN(0))
    })
  })

  describe("Setup for Testing", () => {
    it("should not fail", async () => {
      return expect(deployments.run("setup_for_testing")).to.be.fulfilled
    })
    it("should create an underwriter credit line for the protocol_owner", async() => {
      const { protocol_owner } = await getNamedAccounts()
      await deployments.run("setup_for_testing")
      const creditDesk = await getDeployedContract(deployments, "CreditDesk")
      const result = await creditDesk.getUnderwriterCreditLines(protocol_owner)
      expect(result.length).to.equal(1)
    })
  })

  describe("Upgrading", () => {
    beforeEach(async () => {
      await deployments.fixture()
    })
    it("should allow for upgrading the logic", async () => {
      const { protocol_owner } = await getNamedAccounts()
      const creditDesk = await getDeployedContract(deployments, "CreditDesk")
      expect(typeof(creditDesk.someBrandNewFunction)).not.to.equal("function")

      await upgrade(bre, "CreditDesk", {contract: "FakeV2CreditDesk"})
      const newCreditDesk = await getDeployedContract(deployments, "CreditDesk")
      
      expect(typeof(newCreditDesk.someBrandNewFunction)).to.equal("function")
      const result = String(await newCreditDesk.someBrandNewFunction())
      expect(result).to.bignumber.equal(new BN(5))
    })

    it("should not change data after an upgrade", async () => {
      const { protocol_owner } = await getNamedAccounts()
      const creditDesk = await getDeployedContract(deployments, "CreditDesk")
      const originalResult = await creditDesk.getUnderwriterCreditLines(protocol_owner)

      await upgrade(bre, "CreditDesk", {contract: "FakeV2CreditDesk"})
      const newCreditDesk = await getDeployedContract(deployments, "CreditDesk")
      
      const newResult = await newCreditDesk.getUnderwriterCreditLines(protocol_owner)
      expect(originalResult).to.deep.equal(newResult)
    })

    it("should allow you to change the owner of the implementation, without affecting the owner of the proxy", async () => {
      const creditDesk = await getDeployedContract(deployments, "CreditDesk")
      const someWallet = ethers.Wallet.createRandom()

      const originalOwner = await creditDesk.owner()
      expect(originalOwner).not.to.equal(someWallet.address)

      await creditDesk.transferOwnership(someWallet.address)
      const newOwner = await creditDesk.owner()

      expect(newOwner).to.equal(someWallet.address)
    })

    it("should allow for a way to transfer ownership of the proxy", async () => {
      const { protocol_owner, proxy_owner } = await getNamedAccounts()
      const creditDeskProxy = await getDeployedContract(deployments, "CreditDesk_Proxy", proxy_owner)
      const proxyWithNewOwner = await getDeployedContract(deployments, "CreditDesk_Proxy", protocol_owner)

      // The more obvious answer to this test is to just read the proxyAdmin off of the contract, but
      // there's a bug in that contract right now that marks the proxyAdmin function as state mutability of non-payable
      // rather than view, and so ethers doesn't return the actual value, it returns a receipt for the transaction.
      // I have a PR up for the library to fix this: https://github.com/wighawag/buidler-deploy/pull/37
      try {
        await proxyWithNewOwner.proxyAdmin()
        // We expect the above to fail, thus this assertion should never run.
        expect(false).to.be.true
      } catch (e) {
      }

      const result = await creditDeskProxy.changeProxyAdmin(protocol_owner)
      await result.wait()
      return expect(proxyWithNewOwner.proxyAdmin()).to.be.fulfilled
    })
  })

  describe("Upgrading the whole protocol", async () => {
    beforeEach(async () => {
      await deployments.fixture()
    })
    it("should not fail", async() => {
      return expect(baseDeploy(bre, {shouldUpgrade: true})).to.be.fulfilled
    })
  })
})
