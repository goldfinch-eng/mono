/* global web3 */
import hre from "hardhat"
import {asNonNullable, assertNonEmptyArray, assertNonNullable} from "@goldfinch-eng/utils"
import {deployAllContracts} from "./testHelpers"
import {GoldfinchIdentityInstance} from "../typechain/truffle"
import {
  getContract,
  OWNER_ROLE,
  PAUSER_ROLE,
  SIGNER_ROLE,
  TRUFFLE_CONTRACT_PROVIDER,
} from "../blockchain_scripts/deployHelpers"
import {GoldfinchIdentity} from "../typechain/ethers"
import {constants as ethersConstants} from "ethers"
import {GOLDFINCH_IDENTITY_METADATA_URI} from "../blockchain_scripts/goldfinchIdentity/constants"
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  const {deploy} = deployments
  const [_owner, _anotherUser] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const uninitializedGoldfinchIdentityDeployer = asNonNullable(_anotherUser)

  const deployed = await deployAllContracts(deployments)

  const goldfinchIdentity = deployed.goldfinchIdentity

  const uninitializedGoldfinchIdentityDeployResult = await deploy("GoldfinchIdentity", {
    from: uninitializedGoldfinchIdentityDeployer,
    gasLimit: 4000000,
  })
  const uninitializedGoldfinchIdentity = await getContract<GoldfinchIdentity, GoldfinchIdentityInstance>(
    "GoldfinchIdentity",
    TRUFFLE_CONTRACT_PROVIDER,
    {
      at: uninitializedGoldfinchIdentityDeployResult.address,
    }
  )

  return {owner, goldfinchIdentity, uninitializedGoldfinchIdentity, uninitializedGoldfinchIdentityDeployer}
})

describe("GoldfinchIdentity", () => {
  let owner: string,
    goldfinchIdentity: GoldfinchIdentityInstance,
    uninitializedGoldfinchIdentityDeployer: string,
    uninitializedGoldfinchIdentity: GoldfinchIdentityInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, goldfinchIdentity, uninitializedGoldfinchIdentityDeployer, uninitializedGoldfinchIdentity} =
      await setupTest())
  })

  describe("initialize", () => {
    it("rejects zero address owner", async () => {
      const initialized = uninitializedGoldfinchIdentity.initialize(
        ethersConstants.AddressZero,
        GOLDFINCH_IDENTITY_METADATA_URI
      )
      await expect(initialized).to.be.rejectedWith(/Owner address cannot be empty/)
    })
    it("grants owner the owner, pauser, and signer roles", async () => {
      expect(await goldfinchIdentity.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await goldfinchIdentity.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await goldfinchIdentity.hasRole(SIGNER_ROLE, owner)).to.equal(true)
    })
    it("does not grant the deployer the owner, pauser, nor signer roles", async () => {
      await uninitializedGoldfinchIdentity.initialize(owner, GOLDFINCH_IDENTITY_METADATA_URI, {
        from: uninitializedGoldfinchIdentityDeployer,
      })
      expect(await goldfinchIdentity.hasRole(OWNER_ROLE, uninitializedGoldfinchIdentityDeployer)).to.equal(false)
      expect(await goldfinchIdentity.hasRole(PAUSER_ROLE, uninitializedGoldfinchIdentityDeployer)).to.equal(false)
      expect(await goldfinchIdentity.hasRole(SIGNER_ROLE, uninitializedGoldfinchIdentityDeployer)).to.equal(false)
    })
  })

  describe("balanceOf", () => {
    it("returns 0 for a non-minted token", async () => {
      // TODO
    })
    it("returns the amount for a minted token", async () => {
      // TODO
    })
    it("returns 0 for a token that was minted and then burned", async () => {
      // TODO
    })
  })

  describe("mint", () => {
    beforeEach(async () => {
      // TODO
    })

    describe("validates signature", () => {
      it("rejects incorrect `to` address in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `id` in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `amount` in hashed message", async () => {
        // TODO
      })
      it("ignores `data` in hashed message", async () => {
        // TODO
      })
      it("allows address with signer role", async () => {
        // TODO
      })
      it("rejects address without signer role", async () => {
        // TODO
      })
      it("rejects empty signature", async () => {
        // TODO
      })
      it("rejects reuse of a signature", async () => {
        // TODO
      })
    })

    describe("requires payment", () => {
      it("rejects insufficient payment", async () => {
        // TODO
      })
      it("accepts minimum payment", async () => {
        // TODO
      })
      it("accepts overpayment", async () => {
        // TODO
      })
    })

    describe("validates account", () => {
      it("rejects 0 address", async () => {
        // TODO
      })
    })

    describe("validates id", () => {
      it("allows token id of 0", async () => {
        // TODO
      })
      it("rejects token id > 0", async () => {
        // TODO
      })
    })

    describe("validates amount", () => {
      it("rejects 0 amount", async () => {
        // TODO
      })
      it("allows amount of 1", async () => {
        // TODO
      })
      it("allows amount > 1", async () => {
        // TODO
      })
    })

    it("updates state and emits an event", async () => {
      // TODO
    })

    context("paused", () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("mintBatch", () => {
    beforeEach(async () => {
      // TODO
    })

    describe("validates signature", () => {
      it("rejects incorrect `to` address in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `ids` in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `amounts` in hashed message", async () => {
        // TODO
      })
      it("ignores `data` in hashed message", async () => {
        // TODO
      })
      it("allows address with signer role", async () => {
        // TODO
      })
      it("rejects address without signer role", async () => {
        // TODO
      })
      it("rejects empty signature", async () => {
        // TODO
      })
      it("rejects reuse of a signature", async () => {
        // TODO
      })
    })

    describe("requires payment", () => {
      it("rejects insufficient payment", async () => {
        // TODO
      })
      it("accepts minimum payment", async () => {
        // TODO
      })
      it("accepts overpayment", async () => {
        // TODO
      })
    })

    describe("validates account", () => {
      it("rejects 0 address", async () => {
        // TODO
      })
    })

    describe("validates ids", () => {
      it("allows token id of 0", async () => {
        // TODO
      })
      it("rejects token id > 0", async () => {
        // TODO
      })
      it("rejects ids of different length than amounts", async () => {
        // TODO
      })
    })

    describe("validates amount", () => {
      it("rejects 0 amount", async () => {
        // TODO
      })
      it("allows amount of 1", async () => {
        // TODO
      })
      it("allows amount > 1", async () => {
        // TODO
      })
      it("rejects amounts of different length than ids", async () => {
        // TODO
      })
    })

    it("updates state and emits an event", async () => {
      // TODO
    })

    context("paused", () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("safeTransferFrom", () => {
    it("rejects because transfer is disabled", async () => {
      // TODO
    })

    context("paused", () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("safeBatchTransferFrom", () => {
    it("rejects because transfer is disabled", async () => {
      // TODO
    })

    context("paused", () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("burn", () => {
    beforeEach(async () => {
      // TODO
    })

    describe("validates signature", () => {
      it("rejects incorrect `to` address in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `id` in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `value` in hashed message", async () => {
        // TODO
      })
      it("allows address with signer role", async () => {
        // TODO
      })
      it("rejects address without signer role", async () => {
        // TODO
      })
      it("rejects empty signature", async () => {
        // TODO
      })
      it("rejects reuse of a signature", async () => {
        // TODO
      })
    })

    describe("validates account", () => {
      it("rejects 0 address", async () => {
        // TODO
      })
      it("allows account for which token id exists", async () => {
        // TODO
      })
      it("rejects account for which token id does not exist", async () => {
        // TODO
      })
    })

    describe("validates id", () => {
      it("allows token id that exists", async () => {
        // TODO
      })
      it("rejects token id that does not exist", async () => {
        // TODO
      })
    })

    describe("validates value", () => {
      it("rejects value that does not equal amount on token", async () => {
        // TODO
      })
      it("allows value that equals amount on token", async () => {
        // TODO expect balanceOf before the burn not to equal 0 and after the burn to equal 0.
      })
    })

    it("updates state and emits an event", async () => {
      // TODO
    })

    context("paused", () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("burnBatch", () => {
    beforeEach(async () => {
      // TODO
    })

    describe("validates signature", () => {
      it("rejects incorrect `to` address in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `ids` in hashed message", async () => {
        // TODO
      })
      it("rejects incorrect `values` in hashed message", async () => {
        // TODO
      })
      it("allows address with signer role", async () => {
        // TODO
      })
      it("rejects address without signer role", async () => {
        // TODO
      })
      it("rejects empty signature", async () => {
        // TODO
      })
      it("rejects reuse of a signature", async () => {
        // TODO
      })
    })

    describe("validates account", () => {
      it("rejects 0 address", async () => {
        // TODO
      })
      it("allows account for which token id exists", async () => {
        // TODO
      })
      it("rejects account for which token id does not exist", async () => {
        // TODO
      })
    })

    describe("validates ids", () => {
      it("allows token ids that exist", async () => {
        // TODO
      })
      it("rejects token id that does not exist", async () => {
        // TODO
      })
      it("rejects ids of different length than values", async () => {
        // TODO
      })
    })

    describe("validates value", () => {
      it("rejects value that does not equal amount on token", async () => {
        // TODO
      })
      it("allows values that equal amounts on tokens", async () => {
        // TODO expect balanceOf before the burn not to equal 0 and after the burn to equal 0.
      })
      it("rejects values of different length than ids", async () => {
        // TODO
      })
    })

    it("updates state and emits an event", async () => {
      // TODO
    })

    context("paused", () => {
      it("reverts", async () => {
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
