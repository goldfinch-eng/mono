/* global web3 */
import hre from "hardhat"
import _ from "lodash"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {deployAllContracts} from "./testHelpers"
import {
  getContract,
  OWNER_ROLE,
  PAUSER_ROLE,
  SIGNER_ROLE,
  TRUFFLE_CONTRACT_PROVIDER,
} from "../blockchain_scripts/deployHelpers"
import {GoldfinchIdentity} from "../typechain/ethers"
import {constants as ethersConstants, BigNumber} from "ethers"
import {GOLDFINCH_IDENTITY_METADATA_URI} from "../blockchain_scripts/goldfinchIdentity/constants"
import {BN} from "ethereumjs-tx/node_modules/ethereumjs-util"
import {pack} from "@ethersproject/solidity"
import {keccak256} from "@ethersproject/keccak256"
import {GoldfinchIdentityInstance} from "../typechain/truffle/GoldfinchIdentity"
const {deployments} = hre

const EMPTY_STRING_HEX = web3.utils.asciiToHex("")

const setupTest = deployments.createFixture(async ({deployments}) => {
  const {deploy} = deployments
  const [_owner, _anotherUser, _anotherUser2] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const anotherUser = asNonNullable(_anotherUser)
  const uninitializedGoldfinchIdentityDeployer = asNonNullable(_anotherUser2)

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

  return {owner, anotherUser, goldfinchIdentity, uninitializedGoldfinchIdentity, uninitializedGoldfinchIdentityDeployer}
})

const sign = async (
  signerAddress: string,
  messageBaseElements: {types: string[]; values: Array<BN | string>},
  nonce: BN
): Promise<string> => {
  const signer = (await hre.ethers.getSigners()).find((signer) => signer.address === signerAddress)
  assertNonNullable(signer)

  if (messageBaseElements.types.length !== messageBaseElements.values.length) {
    throw new Error("Invalid message elements")
  }

  // Append nonce to base elements of message.
  const types = messageBaseElements.types.concat("uint256")
  const _values = messageBaseElements.values.concat(nonce)

  // Convert BN values to BigNumber, since ethers utils use BigNumber.
  const values = _values.map((val: BN | string) => (BN.isBN(val) ? BigNumber.from(val.toString()) : val))

  // Use packed encoding if none of the message elements is an array. This corresponds to our usage of `abi.encode()`
  // instead of `abi.encodePacked()` in the GoldfinchIdentity contract, based on whether any of the parameters are of dynamic type.
  const encoded = _.some(values, Array.isArray) ? web3.eth.abi.encodeParameters(types, values) : pack(types, values)

  const hashed = keccak256(encoded)

  // Cf. https://github.com/ethers-io/ethers.js/blob/ce8f1e4015c0f27bf178238770b1325136e3351a/docs/v5/api/signer/README.md#note
  const arrayified = hre.ethers.utils.arrayify(hashed)
  return signer.signMessage(arrayified)
}

describe("GoldfinchIdentity", () => {
  let owner: string,
    anotherUser: string,
    goldfinchIdentity: GoldfinchIdentityInstance,
    uninitializedGoldfinchIdentityDeployer: string,
    uninitializedGoldfinchIdentity: GoldfinchIdentityInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, anotherUser, goldfinchIdentity, uninitializedGoldfinchIdentityDeployer, uninitializedGoldfinchIdentity} =
      await setupTest())
  })

  async function mint(recipient: string, tokenId: BN, amount: BN, nonce: BN, signer: string): Promise<void> {
    const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
    const signature = await sign(signer, {types: ["address", "uint256", "uint256"], values: messageElements}, nonce)
    await goldfinchIdentity.mint(...messageElements, EMPTY_STRING_HEX, signature, {
      from: recipient,
      value: new BN(0.00083e18),
    })
  }

  async function burn(recipient: string, tokenId: BN, value: BN, nonce: BN, signer: string): Promise<void> {
    const messageElements: [string, BN, BN] = [recipient, tokenId, value]
    const signature = await sign(signer, {types: ["address", "uint256", "uint256"], values: messageElements}, nonce)
    await goldfinchIdentity.burn(...messageElements, signature, {from: recipient})
  }

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
      expect(await goldfinchIdentity.balanceOf(anotherUser, new BN(0))).to.bignumber.equal(new BN(0))
    })
    it("returns the amount for a minted token", async () => {
      const tokenId = new BN(0)
      const amount = new BN(1)
      await mint(anotherUser, tokenId, amount, new BN(0), owner)
      expect(await goldfinchIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(amount)
    })
    it("returns 0 for a token that was minted and then burned", async () => {
      const tokenId = new BN(0)
      const amount = new BN(1)
      await mint(anotherUser, tokenId, amount, new BN(0), owner)
      await burn(anotherUser, tokenId, amount, new BN(1), owner)
      expect(await goldfinchIdentity.balanceOf(anotherUser, tokenId)).to.bignumber.equal(new BN(0))
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
      it("rejects if called without signature", async () => {
        // TODO
      })

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
      it("rejects if called without signature", async () => {
        // TODO
      })

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
