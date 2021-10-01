/* global web3 */
import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {BN} from "ethereumjs-tx/node_modules/ethereumjs-util"
import {BigNumber, constants as ethersConstants} from "ethers"
import hre from "hardhat"
import _ from "lodash"
import {
  getContract,
  OWNER_ROLE,
  PAUSER_ROLE,
  SIGNER_ROLE,
  TRUFFLE_CONTRACT_PROVIDER,
} from "../blockchain_scripts/deployHelpers"
import {GOLDFINCH_IDENTITY_METADATA_URI} from "../blockchain_scripts/goldfinchIdentity/constants"
import {TestGoldfinchIdentity} from "../typechain/ethers"
import {TransferSingle} from "../typechain/truffle/GoldfinchIdentity"
import {TestGoldfinchIdentityInstance} from "../typechain/truffle/TestGoldfinchIdentity"
import {decodeLogs, deployAllContracts, getOnlyLog} from "./testHelpers"
const {deployments} = hre

const MINT_MESSAGE_ELEMENT_TYPES = ["address", "uint256", "uint256"]
const EMPTY_STRING_HEX = web3.utils.asciiToHex("")
const MINT_PAYMENT = new BN(0.00083e18)

const BURN_MESSAGE_ELEMENT_TYPES = ["address", "uint256", "uint256"]

const setupTest = deployments.createFixture(async ({deployments}) => {
  const {deploy} = deployments
  const [_owner, _anotherUser, _anotherUser2, _anotherUser3] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const anotherUser = asNonNullable(_anotherUser)
  const anotherUser2 = asNonNullable(_anotherUser2)
  const uninitializedGoldfinchIdentityDeployer = asNonNullable(_anotherUser3)

  const deployed = await deployAllContracts(deployments)

  const goldfinchIdentity = deployed.goldfinchIdentity

  const uninitializedGoldfinchIdentityDeployResult = await deploy("TestGoldfinchIdentity", {
    from: uninitializedGoldfinchIdentityDeployer,
    gasLimit: 4000000,
  })
  const uninitializedGoldfinchIdentity = await getContract<TestGoldfinchIdentity, TestGoldfinchIdentityInstance>(
    "TestGoldfinchIdentity",
    TRUFFLE_CONTRACT_PROVIDER,
    {
      at: uninitializedGoldfinchIdentityDeployResult.address,
    }
  )

  return {
    owner,
    anotherUser,
    anotherUser2,
    goldfinchIdentity,
    uninitializedGoldfinchIdentity,
    uninitializedGoldfinchIdentityDeployer,
  }
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

  if (_.some(values, Array.isArray)) {
    // If we want to support signing a message whose elements can be arrays, we'd want to encode the values using
    // a utility corresponding to `abi.encode()`, rather than `abi.encodePacked()`, because packed encoding is
    // ambiguous for multiple parameters of dynamic type (cf. https://github.com/ethereum/solidity/blob/v0.8.4/docs/abi-spec.rst#non-standard-packed-mode).
    // This is something to keep in mind if we ever implement `mintBatch()` or `burnBatch()`, which would use
    // array parameters. For now, we're defensive here against this issue.
    throw new Error("Expected no array values.")
  }
  const encoded = pack(types, values)
  const hashed = keccak256(encoded)

  // Cf. https://github.com/ethers-io/ethers.js/blob/ce8f1e4015c0f27bf178238770b1325136e3351a/docs/v5/api/signer/README.md#note
  const arrayified = hre.ethers.utils.arrayify(hashed)
  return signer.signMessage(arrayified)
}

describe("GoldfinchIdentity", () => {
  let owner: string,
    anotherUser: string,
    anotherUser2: string,
    goldfinchIdentity: TestGoldfinchIdentityInstance,
    uninitializedGoldfinchIdentityDeployer: string,
    uninitializedGoldfinchIdentity: TestGoldfinchIdentityInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      anotherUser,
      anotherUser2,
      goldfinchIdentity,
      uninitializedGoldfinchIdentityDeployer,
      uninitializedGoldfinchIdentity,
    } = await setupTest())
  })

  type MintParams = [string, BN, BN, string]
  type BurnParams = [string, BN, BN]

  async function mint(
    recipient: string,
    tokenId: BN,
    amount: BN,
    nonce: BN,
    signer: string,
    overrideMintParams?: MintParams,
    overrideFrom?: string
  ): Promise<void> {
    const contractBalanceBefore = await web3.eth.getBalance(goldfinchIdentity.address)
    const tokenBalanceBefore = await goldfinchIdentity.balanceOf(recipient, tokenId)

    const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
    const signature = await sign(signer, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, nonce)

    const defaultMintParams: MintParams = [recipient, tokenId, amount, EMPTY_STRING_HEX]
    const mintParams: MintParams = overrideMintParams || defaultMintParams

    const defaultFrom = recipient
    const from = overrideFrom || defaultFrom

    const receipt = await goldfinchIdentity.mint(...mintParams, signature, {
      from,
      value: MINT_PAYMENT,
    })

    // Verify contract state.
    const contractBalanceAfter = await web3.eth.getBalance(goldfinchIdentity.address)
    expect(new BN(contractBalanceAfter).sub(new BN(contractBalanceBefore))).to.bignumber.equal(MINT_PAYMENT)

    const tokenBalanceAfter = await goldfinchIdentity.balanceOf(recipient, tokenId)
    expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.bignumber.equal(amount)

    expect(await goldfinchIdentity.nonces(recipient)).to.bignumber.equal(nonce.add(new BN(1)))

    // Verify that event was emitted.
    const transferEvent = getOnlyLog<TransferSingle>(
      decodeLogs(receipt.receipt.rawLogs, goldfinchIdentity, "TransferSingle")
    )
    expect(transferEvent.args.operator).to.equal(from)
    expect(transferEvent.args.from).to.equal(ethersConstants.AddressZero)
    expect(transferEvent.args.to).to.equal(recipient)
    expect(transferEvent.args.id).to.bignumber.equal(tokenId)
    expect(transferEvent.args.value).to.bignumber.equal(amount)
  }

  async function burn(
    recipient: string,
    tokenId: BN,
    value: BN,
    nonce: BN,
    signer: string,
    overrideBurnParams?: BurnParams,
    overrideFrom?: string
  ): Promise<void> {
    const contractBalanceBefore = await web3.eth.getBalance(goldfinchIdentity.address)
    const tokenBalanceBefore = await goldfinchIdentity.balanceOf(recipient, tokenId)

    const messageElements: [string, BN, BN] = [recipient, tokenId, value]
    const signature = await sign(signer, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, nonce)

    const defaultBurnParams: BurnParams = [recipient, tokenId, value]
    const burnParams: BurnParams = overrideBurnParams || defaultBurnParams

    const defaultFrom = recipient
    const from = overrideFrom || defaultFrom

    const receipt = await goldfinchIdentity.burn(...burnParams, signature, {from})

    // Verify contract state.
    const contractBalanceAfter = await web3.eth.getBalance(goldfinchIdentity.address)
    expect(new BN(contractBalanceAfter)).to.bignumber.equal(new BN(contractBalanceBefore))

    const tokenBalanceAfter = await goldfinchIdentity.balanceOf(recipient, tokenId)
    expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.bignumber.equal(value)
    expect(tokenBalanceAfter).to.bignumber.equal(new BN(0))

    expect(await goldfinchIdentity.nonces(recipient)).to.bignumber.equal(nonce.add(new BN(1)))

    // Verify that event was emitted.
    const transferEvent = getOnlyLog<TransferSingle>(
      decodeLogs(receipt.receipt.rawLogs, goldfinchIdentity, "TransferSingle")
    )
    expect(transferEvent.args.operator).to.equal(from)
    expect(transferEvent.args.from).to.equal(recipient)
    expect(transferEvent.args.to).to.equal(ethersConstants.AddressZero)
    expect(transferEvent.args.id).to.bignumber.equal(tokenId)
    expect(transferEvent.args.value).to.bignumber.equal(value)
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
      const recipient = anotherUser
      expect(await goldfinchIdentity.balanceOf(recipient, new BN(0))).to.bignumber.equal(new BN(0))
    })
    it("returns the amount for a minted token", async () => {
      const recipient = anotherUser
      const tokenId = new BN(0)
      const amount = new BN(1)
      await mint(recipient, tokenId, amount, new BN(0), owner)
      expect(await goldfinchIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(amount)
    })
    it("returns 0 for a token that was minted and then burned", async () => {
      const recipient = anotherUser
      const tokenId = new BN(0)
      const amount = new BN(1)
      await mint(recipient, tokenId, amount, new BN(0), owner)
      await burn(recipient, tokenId, amount, new BN(1), owner)
      expect(await goldfinchIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(0))
    })
  })

  describe("mint", () => {
    let recipient: string, tokenId: BN, amount: BN

    beforeEach(async () => {
      recipient = anotherUser
      tokenId = new BN(0)
      amount = new BN(1)
    })

    describe("validates signature", () => {
      it("rejects incorrect `to` address in hashed message", async () => {
        const incorrectTo = owner
        await expect(
          mint(recipient, tokenId, amount, new BN(0), owner, [incorrectTo, tokenId, amount, EMPTY_STRING_HEX])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect `id` in hashed message", async () => {
        const incorrectId = tokenId.add(new BN(1))
        await expect(
          mint(recipient, tokenId, amount, new BN(0), owner, [recipient, incorrectId, amount, EMPTY_STRING_HEX])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect `amount` in hashed message", async () => {
        const incorrectAmount = amount.add(new BN(1))
        await expect(
          mint(recipient, tokenId, amount, new BN(0), owner, [recipient, tokenId, incorrectAmount, EMPTY_STRING_HEX])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("ignores `data` in hashed message", async () => {
        const incorrectData = "0xf00"
        await expect(mint(recipient, tokenId, amount, new BN(0), owner, [recipient, tokenId, amount, incorrectData])).to
          .be.fulfilled
      })
      it("allows address with signer role", async () => {
        expect(await goldfinchIdentity.hasRole(SIGNER_ROLE, owner)).to.equal(true)
        await expect(mint(recipient, tokenId, amount, new BN(0), owner)).to.be.fulfilled
      })
      it("rejects address without signer role", async () => {
        expect(await goldfinchIdentity.hasRole(SIGNER_ROLE, recipient)).to.equal(false)
        await expect(mint(recipient, tokenId, amount, new BN(0), recipient)).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects empty signature", async () => {
        const emptySignature = EMPTY_STRING_HEX
        const mintParams: MintParams = [recipient, tokenId, amount, EMPTY_STRING_HEX]
        await expect(
          goldfinchIdentity.mint(...mintParams, emptySignature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/ECDSA: invalid signature length/)
      })
      it("rejects reuse of a signature", async () => {
        const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [recipient, tokenId, amount, EMPTY_STRING_HEX]
        await goldfinchIdentity.mint(...mintParams, signature, {
          from: recipient,
          value: MINT_PAYMENT,
        })
        await expect(
          goldfinchIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("allows any sender bearing a valid signature", async () => {
        await expect(mint(recipient, tokenId, amount, new BN(0), owner, undefined, anotherUser2)).to.be.fulfilled
      })
    })

    describe("requires payment", () => {
      it("rejects insufficient payment", async () => {
        const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [recipient, tokenId, amount, EMPTY_STRING_HEX]
        await expect(
          goldfinchIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT.sub(new BN(1)),
          })
        ).to.be.rejectedWith(/Token mint requires 0\.00083 ETH/)
      })
      it("accepts minimum payment", async () => {
        const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [recipient, tokenId, amount, EMPTY_STRING_HEX]
        await expect(
          goldfinchIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.fulfilled
      })
      it("accepts overpayment", async () => {
        const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [recipient, tokenId, amount, EMPTY_STRING_HEX]
        await expect(
          goldfinchIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT.add(new BN(1)),
          })
        ).to.be.fulfilled
      })
    })

    describe("validates account", () => {
      it("rejects 0 address", async () => {
        const messageElements: [string, BN, BN] = [ethersConstants.AddressZero, tokenId, amount]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [ethersConstants.AddressZero, tokenId, amount, EMPTY_STRING_HEX]
        await expect(
          goldfinchIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/ERC1155: mint to the zero address/)
      })
    })

    describe("validates id", () => {
      it("allows token id of 0", async () => {
        await expect(mint(recipient, new BN(0), amount, new BN(0), owner)).to.be.fulfilled
      })
      it("rejects token id > 0", async () => {
        await expect(mint(recipient, new BN(1), amount, new BN(0), owner)).to.be.rejectedWith(/Token id not supported/)
      })
    })

    describe("validates amount", () => {
      it("rejects 0 amount", async () => {
        await expect(mint(recipient, tokenId, new BN(0), new BN(0), owner)).to.be.rejectedWith(
          /Amount must be greater than 0/
        )
      })
      it("allows amount of 1", async () => {
        await expect(mint(recipient, tokenId, new BN(1), new BN(0), owner)).to.be.fulfilled
      })
      it("allows amount > 1", async () => {
        await expect(mint(recipient, tokenId, new BN(2), new BN(0), owner)).to.be.fulfilled
      })
      it("does not reject duplicative minting, i.e. where amount before minting is > 0", async () => {
        // TODO[PR] Should we reject in this case?
        await mint(recipient, tokenId, amount, new BN(0), owner)
        expect(await goldfinchIdentity.balanceOf(recipient, new BN(0))).to.bignumber.equal(new BN(1))
        await expect(mint(recipient, tokenId, amount, new BN(1), owner)).to.be.fulfilled
      })
    })

    it("updates state and emits an event", async () => {
      await expect(mint(recipient, tokenId, amount, new BN(0), owner)).to.be.fulfilled
      // (State updates and event emitted are established in `mint()`.)
    })

    context("paused", () => {
      it("reverts", async () => {
        await goldfinchIdentity.pause()
        await expect(mint(recipient, tokenId, amount, new BN(0), owner)).to.be.rejectedWith(
          /ERC1155Pausable: token transfer while paused/
        )
      })
    })

    // TODO[PR] Should we test execution of the received hook?
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
    let recipient: string, tokenId: BN, value: BN

    beforeEach(async () => {
      recipient = anotherUser
      tokenId = new BN(0)
      value = new BN(1)

      await mint(recipient, tokenId, value, new BN(0), owner)
    })

    describe("validates signature", () => {
      it("rejects incorrect `to` address in hashed message", async () => {
        const incorrectTo = owner
        await expect(
          burn(recipient, tokenId, value, new BN(1), owner, [incorrectTo, tokenId, value])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect `id` in hashed message", async () => {
        const incorrectId = tokenId.add(new BN(1))
        await expect(
          burn(recipient, tokenId, value, new BN(1), owner, [recipient, incorrectId, value])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect `value` in hashed message", async () => {
        const incorrectValue = value.add(new BN(1))
        await expect(
          burn(recipient, tokenId, value, new BN(1), owner, [recipient, tokenId, incorrectValue])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("allows address with signer role", async () => {
        expect(await goldfinchIdentity.hasRole(SIGNER_ROLE, owner)).to.equal(true)
        await expect(burn(recipient, tokenId, value, new BN(1), owner)).to.be.fulfilled
      })
      it("rejects address without signer role", async () => {
        expect(await goldfinchIdentity.hasRole(SIGNER_ROLE, recipient)).to.equal(false)
        await expect(burn(recipient, tokenId, value, new BN(1), recipient)).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects empty signature", async () => {
        const emptySignature = EMPTY_STRING_HEX
        const burnParams: BurnParams = [recipient, tokenId, value]
        await expect(
          goldfinchIdentity.burn(...burnParams, emptySignature, {
            from: recipient,
          })
        ).to.be.rejectedWith(/ECDSA: invalid signature length/)
      })
      it("rejects reuse of a signature", async () => {
        const messageElements: [string, BN, BN] = [recipient, tokenId, value]
        const signature = await sign(owner, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(1))
        const burnParams: BurnParams = [recipient, tokenId, value]
        await goldfinchIdentity.burn(...burnParams, signature, {
          from: recipient,
        })
        await expect(
          goldfinchIdentity.burn(...burnParams, signature, {
            from: recipient,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("allows any sender bearing a valid signature", async () => {
        await expect(burn(recipient, tokenId, value, new BN(1), owner, undefined, anotherUser2)).to.be.fulfilled
      })
    })

    describe("validates account", () => {
      it("rejects 0 address", async () => {
        const messageElements: [string, BN, BN] = [ethersConstants.AddressZero, tokenId, value]
        const signature = await sign(owner, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const burnParams: BurnParams = [ethersConstants.AddressZero, tokenId, value]
        await expect(
          goldfinchIdentity.burn(...burnParams, signature, {
            from: recipient,
          })
        ).to.be.rejectedWith(/ERC1155: burn from the zero address/)
      })
      it("allows account having token id", async () => {
        expect(await goldfinchIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(value)
        await expect(burn(recipient, tokenId, value, new BN(1), owner)).to.be.fulfilled
      })
      it("allows account not having token id", async () => {
        expect(await goldfinchIdentity.balanceOf(anotherUser2, tokenId)).to.bignumber.equal(new BN(0))
        await expect(burn(anotherUser2, tokenId, new BN(0), new BN(0), owner)).to.be.fulfilled
      })
    })

    describe("validates id", () => {
      it("allows for token id for which minting is supported", async () => {
        await expect(burn(recipient, tokenId, value, new BN(1), owner)).to.be.fulfilled
      })
      it("allows for token id for which minting is not supported", async () => {
        // Retaining the ability to burn a token of id for which minting is not supported is useful for at least two reasons:
        // (1) in case such tokens should never have been mintable but were somehow minted; (2) in case we have deprecated
        // the ability to mint tokens of that id.
        const unsupportedTokenId = tokenId.add(new BN(1))
        expect(await goldfinchIdentity.balanceOf(recipient, unsupportedTokenId)).to.bignumber.equal(new BN(0))
        await expect(mint(recipient, unsupportedTokenId, value, new BN(1), owner)).to.be.rejectedWith(
          /Token id not supported/
        )
        await goldfinchIdentity._mintForTest(recipient, unsupportedTokenId, value, EMPTY_STRING_HEX, {from: owner})
        expect(await goldfinchIdentity.balanceOf(recipient, unsupportedTokenId)).to.bignumber.equal(value)
        await expect(burn(recipient, unsupportedTokenId, value, new BN(2), owner)).to.be.fulfilled
      })
    })

    describe("validates value", () => {
      it("rejects value less than amount on token", async () => {
        expect(await goldfinchIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(1))
        await expect(burn(recipient, tokenId, new BN(0), new BN(1), owner)).to.be.rejectedWith(
          /Balance after burn must be 0/
        )
      })
      it("rejects value greater than amount on token", async () => {
        expect(await goldfinchIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(value)
        await expect(burn(recipient, tokenId, value.add(new BN(1)), new BN(1), owner)).to.be.rejectedWith(
          /ERC1155: burn amount exceeds balance/
        )
      })
      it("allows value that equals amount on token", async () => {
        expect(await goldfinchIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(value)
        await expect(burn(recipient, tokenId, value, new BN(1), owner)).to.be.fulfilled
        expect(await goldfinchIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(0))
      })
    })

    it("updates state and emits an event", async () => {
      await expect(burn(recipient, tokenId, value, new BN(1), owner)).to.be.fulfilled
      // (State updates and event emitted are established in `burn()`.)
    })

    context("paused", () => {
      it("reverts", async () => {
        await goldfinchIdentity.pause()
        await expect(burn(recipient, tokenId, value, new BN(1), owner)).to.be.rejectedWith(
          /ERC1155Pausable: token transfer while paused/
        )
      })
    })
  })

  describe("upgradeability", () => {
    it("is upgradeable", async () => {
      // TODO
    })
  })
})
