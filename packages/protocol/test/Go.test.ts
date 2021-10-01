/* global web3 */
import hre from "hardhat"
import {constants as ethersConstants} from "ethers"
import {asNonNullable} from "@goldfinch-eng/utils"
import {deployAllContracts} from "./testHelpers"
import {getContract, OWNER_ROLE, PAUSER_ROLE, TRUFFLE_CONTRACT_PROVIDER} from "../blockchain_scripts/deployHelpers"
import {Go} from "../typechain/ethers"
import {GoInstance, GoldfinchConfigInstance, TestGoldfinchIdentityInstance} from "../typechain/truffle"
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
  const goldfinchIdentity = deployed.goldfinchIdentity
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
    goldfinchIdentity,
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
    goldfinchIdentity: TestGoldfinchIdentityInstance

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
      goldfinchIdentity,
    } = await setupTest())
  })

  describe("initialize", () => {
    it("rejects zero address owner", async () => {
      const initialized = uninitializedGo.initialize(
        ethersConstants.AddressZero,
        goldfinchConfig.address,
        goldfinchIdentity.address
      )
      await expect(initialized).to.be.rejectedWith(/Owner and config and GoldfinchIdentity addresses cannot be empty/)
    })
    it("rejects zero address config", async () => {
      const initialized = uninitializedGo.initialize(owner, ethersConstants.AddressZero, goldfinchIdentity.address)
      await expect(initialized).to.be.rejectedWith(/Owner and config and GoldfinchIdentity addresses cannot be empty/)
    })
    it("rejects zero address goldfinchIdentity", async () => {
      const initialized = uninitializedGo.initialize(owner, goldfinchConfig.address, ethersConstants.AddressZero)
      await expect(initialized).to.be.rejectedWith(/Owner and config and GoldfinchIdentity addresses cannot be empty/)
    })
    it("grants owner the owner and pauser roles", async () => {
      await uninitializedGo.initialize(owner, goldfinchConfig.address, goldfinchIdentity.address, {
        from: uninitializedGoDeployer,
      })
      expect(await uninitializedGo.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await uninitializedGo.hasRole(PAUSER_ROLE, owner)).to.equal(true)

      expect(await go.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await go.hasRole(PAUSER_ROLE, owner)).to.equal(true)
    })
    it("does not grant deployer the owner and pauser roles", async () => {
      await uninitializedGo.initialize(owner, goldfinchConfig.address, goldfinchIdentity.address, {
        from: uninitializedGoDeployer,
      })
      expect(await uninitializedGo.hasRole(OWNER_ROLE, uninitializedGoDeployer)).to.equal(false)
      expect(await uninitializedGo.hasRole(PAUSER_ROLE, uninitializedGoDeployer)).to.equal(false)
    })
    it("sets config and goldfinchIdentity addresses in state", async () => {
      await uninitializedGo.initialize(owner, goldfinchConfig.address, goldfinchIdentity.address, {
        from: uninitializedGoDeployer,
      })
      expect(await uninitializedGo.config()).to.equal(goldfinchConfig.address)
      expect(await uninitializedGo.goldfinchIdentity()).to.equal(goldfinchIdentity.address)

      expect(await go.config()).to.equal(goldfinchConfig.address)
      expect(await go.goldfinchIdentity()).to.equal(goldfinchIdentity.address)
    })
  })

  describe("updateGoldfinchConfig", () => {
    it("rejects sender who lacks owner role", async () => {
      // TODO
    })
    it("allows sender who has owner role", async () => {
      // TODO
    })
    it("updates config address, emits an event", async () => {
      // TODO
    })

    context("paused", () => {
      it("does not reject", async () => {
        // TODO
      })
    })
  })

  describe("go", () => {
    beforeEach(async () => {
      // TODO
    })

    it("rejects zero address account", async () => {
      // TODO
    })

    context("account with 0 balance GoldfinchIdentity token (id 0)", () => {
      context("account is on legacy go-list", () => {
        it("returns true", async () => {
          // TODO
        })
      })
      context("account is not on legacy go-list", () => {
        it("returns false", async () => {
          // TODO
        })
      })
    })

    context("account with > 0 balance GoldfinchIdentity token (id 0)", () => {
      context("account is on legacy go-list", () => {
        it("returns true", async () => {
          // TODO
        })
      })
      context("account is not on legacy go-list", () => {
        it("returns true", async () => {
          // TODO
        })
      })
    })

    context("paused", () => {
      it("returns anyway", async () => {
        // TODO
      })
    })
  })

  describe("upgradeability", () => {
    it("is upgradeable", async () => {
      // TODO
    })
  })
})
