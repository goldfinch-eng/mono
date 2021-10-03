/* global web3 */

import {asNonNullable} from "@goldfinch-eng/utils"
import {BN} from "ethereumjs-tx/node_modules/ethereumjs-util"
import {expectEvent} from "@openzeppelin/test-helpers"
import {constants as ethersConstants} from "ethers"
import hre from "hardhat"
import {
  getContract,
  OWNER_ROLE,
  PAUSER_ROLE,
  SIGNER_ROLE,
  TRUFFLE_CONTRACT_PROVIDER,
} from "../blockchain_scripts/deployHelpers"
import {GOLDFINCH_IDENTITY_METADATA_URI} from "../blockchain_scripts/goldfinchIdentity/constants"
import {TestGoldfinchIdentity} from "../typechain/ethers"
import {TestGoldfinchIdentityInstance} from "../typechain/truffle/TestGoldfinchIdentity"
import {
  BurnParams,
  BURN_MESSAGE_ELEMENT_TYPES,
  EMPTY_STRING_HEX,
  MintParams,
  MINT_MESSAGE_ELEMENT_TYPES,
  MINT_PAYMENT,
} from "./goldfinchIdentityHelpers"
import {deployAllContracts} from "./testHelpers"
import {mint as mintHelper, burn as burnHelper, sign as signHelper} from "./goldfinchIdentityHelpers"
const {deployments} = hre

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

  async function sign(
    signerAddress: string,
    messageBaseElements: {types: string[]; values: Array<BN | string>},
    nonce: BN
  ): Promise<string> {
    return signHelper(hre, signerAddress, messageBaseElements, nonce)
  }

  async function mint(
    recipient: string,
    tokenId: BN,
    amount: BN,
    nonce: BN,
    signer: string,
    overrideMintParams?: MintParams,
    overrideFrom?: string
  ): Promise<void> {
    return mintHelper(
      hre,
      goldfinchIdentity,
      recipient,
      tokenId,
      amount,
      nonce,
      signer,
      overrideMintParams,
      overrideFrom
    )
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
    return burnHelper(
      hre,
      goldfinchIdentity,
      recipient,
      tokenId,
      value,
      nonce,
      signer,
      overrideBurnParams,
      overrideFrom
    )
  }

  async function pause(): Promise<void> {
    expect(await goldfinchIdentity.paused()).to.equal(false)
    await goldfinchIdentity.pause()
    expect(await goldfinchIdentity.paused()).to.equal(true)
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

  describe("setURI", () => {
    const NEW_URI = "https://example.com"

    it("allows sender who has owner role", async () => {
      expect(await goldfinchIdentity.hasRole(OWNER_ROLE, owner)).to.equal(true)
      await expect(goldfinchIdentity.setURI(NEW_URI, {from: owner})).to.be.fulfilled
    })

    it("rejects sender who lacks owner role", async () => {
      expect(await goldfinchIdentity.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      await expect(goldfinchIdentity.setURI(NEW_URI, {from: anotherUser})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })

    it("updates state but does not emit an event", async () => {
      const tokenId = new BN(0)
      const uriBefore = await goldfinchIdentity.uri(tokenId)
      expect(uriBefore).to.equal(GOLDFINCH_IDENTITY_METADATA_URI)
      const receipt = await goldfinchIdentity.setURI(NEW_URI, {from: owner})
      const uriAfter = await goldfinchIdentity.uri(tokenId)
      expect(uriAfter).to.equal(NEW_URI)
      expectEvent.notEmitted(receipt, "URI")
    })

    context("paused", () => {
      it("allows anyway", async () => {
        await pause()
        await expect(goldfinchIdentity.setURI(NEW_URI)).to.be.fulfilled
      })
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
          mint(recipient, tokenId, amount, new BN(0), owner, [incorrectTo, tokenId, amount])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect `id` in hashed message", async () => {
        const incorrectId = tokenId.add(new BN(1))
        await expect(
          mint(recipient, tokenId, amount, new BN(0), owner, [recipient, incorrectId, amount])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect `amount` in hashed message", async () => {
        const incorrectAmount = amount.add(new BN(1))
        await expect(
          mint(recipient, tokenId, amount, new BN(0), owner, [recipient, tokenId, incorrectAmount])
        ).to.be.rejectedWith(/Invalid signer/)
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
        const mintParams: MintParams = [recipient, tokenId, amount]
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
        const mintParams: MintParams = [recipient, tokenId, amount]
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
        const mintParams: MintParams = [recipient, tokenId, amount]
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
        const mintParams: MintParams = [recipient, tokenId, amount]
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
        const mintParams: MintParams = [recipient, tokenId, amount]
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
        const mintParams: MintParams = [ethersConstants.AddressZero, tokenId, amount]
        await expect(
          goldfinchIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/Cannot mint to the zero address/)
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
        await mint(recipient, tokenId, amount, new BN(0), owner)
        expect(await goldfinchIdentity.balanceOf(recipient, new BN(0))).to.bignumber.equal(new BN(1))
        await expect(mint(recipient, tokenId, amount, new BN(1), owner)).to.be.rejectedWith(
          /Balance before mint must be 0/
        )
      })
    })

    it("updates state and emits an event", async () => {
      await expect(mint(recipient, tokenId, amount, new BN(0), owner)).to.be.fulfilled
      // (State updates and event emitted are established in `mint()`.)
    })

    it("uses the expected amount of gas", async () => {
      const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
      const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
      const mintParams: MintParams = [recipient, tokenId, amount]
      const receipt = await goldfinchIdentity.mint(...mintParams, signature, {
        from: recipient,
        value: MINT_PAYMENT,
      })
      expect(receipt.receipt.gasUsed).to.eq(86437)
    })

    context("paused", () => {
      it("reverts", async () => {
        await pause()
        await expect(mint(recipient, tokenId, amount, new BN(0), owner)).to.be.rejectedWith(
          /ERC1155Pausable: token transfer while paused/
        )
      })
    })
  })

  describe("safeTransferFrom", () => {
    let tokenId: BN, amount: BN

    beforeEach(async () => {
      tokenId = new BN(0)
      amount = new BN(1)

      await mint(anotherUser, tokenId, amount, new BN(0), owner)
    })

    describe("by token owner", () => {
      it("rejects because transfer is disabled", async () => {
        await expect(
          goldfinchIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
            from: anotherUser,
          })
        ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          await expect(
            goldfinchIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
              from: anotherUser,
            })
          ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
        })
      })
    })

    describe("by approved sender who is not token owner", () => {
      it("rejects because transfer is disabled", async () => {
        await goldfinchIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
        expect(await goldfinchIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
        await expect(
          goldfinchIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
            from: anotherUser2,
          })
        ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          await goldfinchIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
          expect(await goldfinchIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
          await expect(
            goldfinchIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
              from: anotherUser2,
            })
          ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
        })
      })
    })
  })

  describe("safeBatchTransferFrom", () => {
    let tokenId: BN, amount: BN

    beforeEach(async () => {
      tokenId = new BN(0)
      amount = new BN(1)

      await mint(anotherUser, tokenId, amount, new BN(0), owner)
    })

    describe("by token owner", () => {
      it("rejects because transfer is disabled", async () => {
        await expect(
          goldfinchIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
            from: anotherUser,
          })
        ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          await expect(
            goldfinchIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
              from: anotherUser,
            })
          ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
        })
      })
    })

    describe("by approved sender who is not token owner", () => {
      it("rejects because transfer is disabled", async () => {
        await goldfinchIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
        expect(await goldfinchIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
        await expect(
          goldfinchIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
            from: anotherUser2,
          })
        ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          await goldfinchIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
          expect(await goldfinchIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
          await expect(
            goldfinchIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
              from: anotherUser2,
            })
          ).to.be.rejectedWith(/Only mint xor burn transfers are allowed/)
        })
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

    it("uses the expected amount of gas", async () => {
      const messageElements: [string, BN, BN] = [recipient, tokenId, value]
      const signature = await sign(owner, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(1))
      const burnParams: BurnParams = [recipient, tokenId, value]
      const receipt = await goldfinchIdentity.burn(...burnParams, signature, {
        from: recipient,
      })
      expect(receipt.receipt.gasUsed).to.eq(47304)
    })

    context("paused", () => {
      it("reverts", async () => {
        await pause()
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
