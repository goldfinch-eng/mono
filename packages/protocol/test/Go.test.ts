/* global web3 */
import hre from "hardhat"
import {constants as ethersConstants} from "ethers"
import {asNonNullable} from "@goldfinch-eng/utils"
import {deployAllContracts, getCurrentTimestamp, SECONDS_PER_DAY, ZERO_ADDRESS} from "./testHelpers"
import {
  getContract,
  GO_LISTER_ROLE,
  OWNER_ROLE,
  PAUSER_ROLE,
  TRUFFLE_CONTRACT_PROVIDER,
} from "../blockchain_scripts/deployHelpers"
import {Go} from "../typechain/ethers"
import {GoInstance, GoldfinchConfigInstance, TestUniqueIdentityInstance} from "../typechain/truffle"
import {mint} from "./uniqueIdentityHelpers"
import {BN} from "ethereumjs-tx/node_modules/ethereumjs-util"
import {DeployResult} from "hardhat-deploy/types"
import {expectEvent} from "@openzeppelin/test-helpers"
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  const {deploy} = deployments
  const [_owner, _anotherUser, _anotherUser2, _anotherUser3] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const anotherUser = asNonNullable(_anotherUser)
  const anotherUser2 = asNonNullable(_anotherUser2)
  const uninitializedGoDeployer = asNonNullable(_anotherUser3)

  const deployed = await deployAllContracts(deployments)

  const goldfinchConfig = deployed.goldfinchConfig
  const uniqueIdentity = deployed.uniqueIdentity
  const go = deployed.go

  const uninitializedGoDeployResult = await deploy("Go", {
    from: uninitializedGoDeployer,
    gasLimit: 4000000,
  })
  const uninitializedGo = await getContract<Go, GoInstance>("Go", TRUFFLE_CONTRACT_PROVIDER, {
    at: uninitializedGoDeployResult.address,
  })

  return {
    owner,
    anotherUser,
    anotherUser2,
    go,
    uninitializedGo,
    uninitializedGoDeployer,
    goldfinchConfig,
    uniqueIdentity,
  }
})

describe("Go", () => {
  let owner: string,
    anotherUser: string,
    anotherUser2: string,
    go: GoInstance,
    uninitializedGoDeployer: string,
    uninitializedGo: GoInstance,
    goldfinchConfig: GoldfinchConfigInstance,
    uniqueIdentity: TestUniqueIdentityInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      anotherUser,
      anotherUser2,
      go,
      uninitializedGoDeployer,
      uninitializedGo,
      goldfinchConfig,
      uniqueIdentity,
    } = await setupTest())
  })

  async function pause(): Promise<void> {
    expect(await go.paused()).to.equal(false)
    await go.pause()
    expect(await go.paused()).to.equal(true)
  }

  describe("initialize", () => {
    it("rejects zero address owner", async () => {
      const initialized = uninitializedGo.initialize(
        ethersConstants.AddressZero,
        goldfinchConfig.address,
        uniqueIdentity.address
      )
      await expect(initialized).to.be.rejectedWith(/Owner and config and UniqueIdentity addresses cannot be empty/)
    })
    it("rejects zero address config", async () => {
      const initialized = uninitializedGo.initialize(owner, ethersConstants.AddressZero, uniqueIdentity.address)
      await expect(initialized).to.be.rejectedWith(/Owner and config and UniqueIdentity addresses cannot be empty/)
    })
    it("rejects zero address uniqueIdentity", async () => {
      const initialized = uninitializedGo.initialize(owner, goldfinchConfig.address, ethersConstants.AddressZero)
      await expect(initialized).to.be.rejectedWith(/Owner and config and UniqueIdentity addresses cannot be empty/)
    })
    it("grants owner the owner and pauser roles", async () => {
      await uninitializedGo.initialize(owner, goldfinchConfig.address, uniqueIdentity.address, {
        from: uninitializedGoDeployer,
      })
      expect(await uninitializedGo.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await uninitializedGo.hasRole(PAUSER_ROLE, owner)).to.equal(true)

      expect(await go.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await go.hasRole(PAUSER_ROLE, owner)).to.equal(true)
    })
    it("does not grant deployer the owner and pauser roles", async () => {
      await uninitializedGo.initialize(owner, goldfinchConfig.address, uniqueIdentity.address, {
        from: uninitializedGoDeployer,
      })
      expect(await uninitializedGo.hasRole(OWNER_ROLE, uninitializedGoDeployer)).to.equal(false)
      expect(await uninitializedGo.hasRole(PAUSER_ROLE, uninitializedGoDeployer)).to.equal(false)
    })
    it("sets config and uniqueIdentity addresses in state", async () => {
      await uninitializedGo.initialize(owner, goldfinchConfig.address, uniqueIdentity.address, {
        from: uninitializedGoDeployer,
      })
      expect(await uninitializedGo.config()).to.equal(goldfinchConfig.address)
      expect(await uninitializedGo.uniqueIdentity()).to.equal(uniqueIdentity.address)

      expect(await go.config()).to.equal(goldfinchConfig.address)
      expect(await go.uniqueIdentity()).to.equal(uniqueIdentity.address)
    })
    it("cannot be called twice", async () => {
      await uninitializedGo.initialize(owner, goldfinchConfig.address, uniqueIdentity.address, {
        from: uninitializedGoDeployer,
      })
      await expect(
        uninitializedGo.initialize(anotherUser2, goldfinchConfig.address, uniqueIdentity.address, {
          from: uninitializedGoDeployer,
        })
      ).to.be.rejectedWith(/Contract instance has already been initialized/)
    })
  })

  describe("updateGoldfinchConfig", () => {
    let newConfig: DeployResult

    beforeEach(async () => {
      newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})
      await goldfinchConfig.setGoldfinchConfig(newConfig.address)
    })

    it("rejects sender who lacks owner role", async () => {
      expect(await go.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      await expect(go.updateGoldfinchConfig({from: anotherUser})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })
    it("allows sender who has owner role", async () => {
      expect(await go.hasRole(OWNER_ROLE, owner)).to.equal(true)
      await expect(go.updateGoldfinchConfig({from: owner})).to.be.fulfilled
    })
    it("updates config address, emits an event", async () => {
      expect(await go.config()).to.equal(goldfinchConfig.address)
      const receipt = await go.updateGoldfinchConfig({from: owner})
      expect(await go.config()).to.equal(newConfig.address)
      expectEvent(receipt, "GoldfinchConfigUpdated", {
        who: owner,
        configAddress: newConfig.address,
      })
    })

    context("paused", () => {
      it("does not reject", async () => {
        await pause()
        await expect(go.updateGoldfinchConfig({from: owner})).to.be.fulfilled
      })
    })
  })

  describe("go", () => {
    it("rejects zero address account", async () => {
      await expect(go.go(ethersConstants.AddressZero)).to.be.rejectedWith(/Zero address is not go-listed/)
    })

    context("account with 0 balance UniqueIdentity token (id 0)", () => {
      beforeEach(async () => {
        const tokenId = new BN(0)
        expect(await uniqueIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(0))
      })

      context("account is on legacy go-list", () => {
        beforeEach(async () => {
          expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
          expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
          await goldfinchConfig.addToGoList(anotherUser, {from: owner})
          expect(await goldfinchConfig.goList(anotherUser)).to.equal(true)
        })

        it("returns true", async () => {
          expect(await go.go(anotherUser)).to.equal(true)
        })
      })
      context("account is not on legacy go-list", () => {
        beforeEach(async () => {
          expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        })

        it("returns false", async () => {
          expect(await go.go(anotherUser)).to.equal(false)
        })
      })
    })

    context("account with > 0 balance UniqueIdentity token (id 0)", () => {
      beforeEach(async () => {
        const tokenId = new BN(0)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
        await mint(hre, uniqueIdentity, tokenId, expiresAt, new BN(0), owner, undefined, anotherUser)
        expect(await uniqueIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(1))
      })

      context("account is on legacy go-list", () => {
        beforeEach(async () => {
          expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
          expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
          await goldfinchConfig.addToGoList(anotherUser, {from: owner})
          expect(await goldfinchConfig.goList(anotherUser)).to.equal(true)
        })

        it("returns true", async () => {
          expect(await go.go(anotherUser)).to.equal(true)
        })
      })

      context("account is not on legacy go-list", () => {
        beforeEach(async () => {
          expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        })

        it("returns true", async () => {
          expect(await go.go(anotherUser)).to.equal(true)
        })
      })
    })

    context("goOnlyIdTypes", () => {
      it("Validates zero address", async () => {
        await expect(go.goOnlyIdTypes(ZERO_ADDRESS, [])).to.be.rejectedWith(/Zero address is not go-listed/)
      })

      it("returns true if has UID and not legacy golisted", async () => {
        const tokenId = new BN(0)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
        await mint(hre, uniqueIdentity, tokenId, expiresAt, new BN(0), owner, undefined, anotherUser)
        expect(await uniqueIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(1))
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
        expect(await go.goOnlyIdTypes(anotherUser, [tokenId])).to.equal(true)
      })

      it("returns true if legacy golisted", async () => {
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
        await goldfinchConfig.addToGoList(anotherUser, {from: owner})
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(true)
        expect(await go.goOnlyIdTypes(anotherUser, [])).to.equal(true)
      })

      it("returns false if not legacy golisted and no included UID", async () => {
        const tokenId = new BN(0)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
        await mint(hre, uniqueIdentity, tokenId, expiresAt, new BN(0), owner, undefined, anotherUser)
        expect(await uniqueIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(1))
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
        expect(await go.goOnlyIdTypes(anotherUser, [1])).to.equal(false)
      })
    })

    context("goSeniorPool", () => {
      it("Validates zero address", async () => {
        await expect(go.goSeniorPool(ZERO_ADDRESS)).to.be.rejectedWith(/Zero address is not go-listed/)
      })

      it("returns true if has UID and not legacy golisted", async () => {
        const tokenId = new BN(0)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
        await mint(hre, uniqueIdentity, tokenId, expiresAt, new BN(0), owner, undefined, anotherUser)
        expect(await uniqueIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(1))
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
        expect(await go.goSeniorPool(anotherUser)).to.equal(true)
      })

      it("returns true if legacy golisted", async () => {
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
        await goldfinchConfig.addToGoList(anotherUser, {from: owner})
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(true)
        expect(await go.goSeniorPool(anotherUser)).to.equal(true)
      })

      it("returns false if not legacy golisted and no included UID", async () => {
        const tokenId = new BN(2)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
        await mint(hre, uniqueIdentity, tokenId, expiresAt, new BN(0), owner, undefined, anotherUser)
        expect(await uniqueIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(1))
        expect(await goldfinchConfig.goList(anotherUser)).to.equal(false)
        expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
        expect(await go.goSeniorPool(anotherUser)).to.equal(false)
      })
    })

    context("paused", () => {
      beforeEach(async () => {
        const tokenId = new BN(0)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
        await mint(hre, uniqueIdentity, tokenId, expiresAt, new BN(0), owner, undefined, anotherUser)
        expect(await uniqueIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(1))
      })

      it("returns anyway", async () => {
        await pause()
        expect(await go.go(anotherUser)).to.equal(true)
      })
    })
  })

  describe("upgradeability", () => {
    it("is upgradeable", async () => {
      // TODO
    })
  })
})
