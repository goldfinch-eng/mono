/* global web3 */

import {asNonNullable} from "@goldfinch-eng/utils"
import {BN} from "ethereumjs-util"
import hre from "hardhat"
import {getTruffleContract, SIGNER_ROLE} from "../blockchain_scripts/deployHelpers"
import {TestUniqueIdentityInstance} from "../typechain/truffle/contracts/test/TestUniqueIdentity"
import {getCurrentTimestamp, SECONDS_PER_DAY} from "./testHelpers"
import {
  BurnParams,
  EMPTY_STRING_HEX,
  MintParams,
  MintToParams,
  MINT_PAYMENT,
  MINT_MESSAGE_ELEMENT_TYPES,
  MINT_TO_MESSAGE_ELEMENT_TYPES,
  mint as mintHelper,
  mintTo as mintToHelper,
  burn as burnHelper,
  sign as signHelper,
} from "./uniqueIdentityHelpers"
import {deployBaseFixture} from "./util/fixtures"
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  const {deploy} = deployments
  const [_owner, _anotherUser, _anotherUser2, _anotherUser3, _anotherUser4] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const anotherUser = asNonNullable(_anotherUser)
  const anotherUser2 = asNonNullable(_anotherUser2)
  const anotherUser3 = asNonNullable(_anotherUser3)
  const uninitializedUniqueIdentityDeployer = asNonNullable(_anotherUser4)

  const deployed = await deployBaseFixture()

  const uniqueIdentity = deployed.uniqueIdentity

  const uninitializedUniqueIdentityDeployResult = await deploy("TestUniqueIdentity", {
    from: uninitializedUniqueIdentityDeployer,
    gasLimit: 4000000,
  })
  const uninitializedUniqueIdentity = await getTruffleContract<TestUniqueIdentityInstance>("TestUniqueIdentity", {
    at: uninitializedUniqueIdentityDeployResult.address,
  })

  return {
    owner,
    anotherUser,
    anotherUser2,
    anotherUser3,
    uniqueIdentity,
    uninitializedUniqueIdentity,
    uninitializedUniqueIdentityDeployer,
  }
})

describe("UniqueIdentity", () => {
  let owner: string,
    anotherUser: string,
    anotherUser2: string,
    anotherUser3: string,
    uniqueIdentity: TestUniqueIdentityInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, anotherUser, anotherUser2, anotherUser3, uniqueIdentity} = await setupTest())
  })

  async function sign(
    signerAddress: string,
    messageBaseElements: {types: string[]; values: Array<BN | string>},
    nonce: BN
  ): Promise<string> {
    return signHelper(hre, signerAddress, messageBaseElements, nonce)
  }

  async function mint(
    tokenId: BN,
    nonce: BN,
    signer: string,
    overrideMintParams?: MintParams,
    overrideFrom?: string,
    overrideChainId?: BN
  ): Promise<void> {
    const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
    return mintHelper(
      hre,
      uniqueIdentity,
      tokenId,
      expiresAt,
      nonce,
      signer,
      overrideMintParams,
      overrideFrom,
      overrideChainId
    )
  }

  async function mintTo(
    recipientAddress: string,
    tokenId: BN,
    nonce: BN,
    signer: string,
    from: string,
    overrideMintToParams?: MintToParams,
    overrideChainId?: BN
  ): Promise<void> {
    const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
    return mintToHelper(
      hre,
      uniqueIdentity,
      recipientAddress,
      tokenId,
      expiresAt,
      nonce,
      signer,
      from,
      overrideMintToParams,
      overrideChainId
    )
  }

  async function burn(
    recipient: string,
    tokenId: BN,
    nonce: BN,
    signer: string,
    overrideBurnParams?: BurnParams,
    overrideFrom?: string,
    overrideChainId?: BN
  ): Promise<void> {
    const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
    return burnHelper(
      hre,
      uniqueIdentity,
      recipient,
      tokenId,
      expiresAt,
      nonce,
      signer,
      overrideBurnParams,
      overrideFrom,
      overrideChainId
    )
  }

  async function pause(): Promise<void> {
    expect(await uniqueIdentity.paused()).to.equal(false)
    await uniqueIdentity.pause()
    expect(await uniqueIdentity.paused()).to.equal(true)
  }

  describe("name and symbol", () => {
    it("Returns correct values", async () => {
      expect(await uniqueIdentity.name()).to.equal("Unique Identity")
      expect(await uniqueIdentity.symbol()).to.equal("UID")
    })
  })

  describe("balanceOf", () => {
    it("returns 0 for a non-minted token", async () => {
      const recipient = anotherUser
      expect(await uniqueIdentity.balanceOf(recipient, new BN(0))).to.bignumber.equal(new BN(0))
    })
    it("returns the amount for a minted token", async () => {
      const recipient = anotherUser
      const tokenId = new BN(0)
      await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
      await mint(tokenId, new BN(0), owner, undefined, recipient)
      expect(await uniqueIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(1))
    })
    it("returns 0 for a token that was minted and then burned", async () => {
      const recipient = anotherUser
      const tokenId = new BN(0)
      await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
      await mint(tokenId, new BN(0), owner, undefined, recipient)
      await burn(recipient, tokenId, new BN(1), owner)
      expect(await uniqueIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(0))
    })
  })

  describe("mint", () => {
    let recipient: string, tokenId: BN, timestamp: BN

    beforeEach(async () => {
      recipient = anotherUser
      tokenId = new BN(0)
      await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
      timestamp = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
    })

    describe("validates signature", () => {
      it("rejects incorrect `id` in hashed message", async () => {
        const incorrectId = tokenId.add(new BN(1))
        await expect(mint(tokenId, new BN(0), owner, [incorrectId, timestamp], recipient)).to.be.rejectedWith(
          /Invalid signer/
        )
      })
      it("rejects incorrect chain id in hashed message", async () => {
        const chainId = await hre.getChainId()
        expect(chainId).to.bignumber.equal(new BN(31337))
        const incorrectChainId = new BN(1)
        await expect(mint(tokenId, new BN(0), owner, undefined, recipient, incorrectChainId)).to.be.rejectedWith(
          /Invalid signer/
        )
      })
      it("allows address with signer role", async () => {
        expect(await uniqueIdentity.hasRole(SIGNER_ROLE, owner)).to.equal(true)
        await expect(mint(tokenId, new BN(0), owner, undefined, recipient)).to.be.fulfilled
      })
      it("rejects address without signer role", async () => {
        expect(await uniqueIdentity.hasRole(SIGNER_ROLE, recipient)).to.equal(false)
        await expect(mint(tokenId, new BN(0), recipient, undefined, recipient)).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects an expired timestamp", async () => {
        timestamp = (await getCurrentTimestamp()).sub(SECONDS_PER_DAY)
        await expect(mint(tokenId, new BN(0), owner, [tokenId, timestamp], recipient)).to.be.rejectedWith(
          /Signature has expired/
        )
      })

      it("rejects empty signature", async () => {
        const emptySignature = EMPTY_STRING_HEX
        const mintParams: MintParams = [tokenId, timestamp]
        await expect(
          uniqueIdentity.mint(...mintParams, emptySignature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/ECDSA: invalid signature length/)
      })
      it("rejects an incorrect contract address", async () => {
        const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, owner]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [tokenId, timestamp]
        await expect(
          uniqueIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects reuse of a signature", async () => {
        const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, uniqueIdentity.address]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [tokenId, timestamp]
        await uniqueIdentity.mint(...mintParams, signature, {
          from: recipient,
          value: MINT_PAYMENT,
        })
        await expect(
          uniqueIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
    })

    describe("requires payment", () => {
      it("rejects insufficient payment", async () => {
        const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, uniqueIdentity.address]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [tokenId, timestamp]
        await expect(
          uniqueIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT.sub(new BN(1)),
          })
        ).to.be.rejectedWith(/Token mint requires 0\.00083 ETH/)
      })
      it("accepts minimum payment", async () => {
        const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, uniqueIdentity.address]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [tokenId, timestamp]
        await expect(
          uniqueIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.fulfilled
      })
      it("accepts overpayment", async () => {
        const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, uniqueIdentity.address]
        const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintParams: MintParams = [tokenId, timestamp]
        await expect(
          uniqueIdentity.mint(...mintParams, signature, {
            from: recipient,
            value: MINT_PAYMENT.add(new BN(1)),
          })
        ).to.be.fulfilled
      })
    })

    describe("validates id", () => {
      beforeEach(async () => {
        await uniqueIdentity.setSupportedUIDTypes([0, 1], [true, false])
      })
      it("allows token id of 0", async () => {
        const tokenId = new BN(0)
        await expect(mint(tokenId, new BN(0), owner, undefined, recipient)).to.be.fulfilled
      })
      it("rejects token id > 0", async () => {
        const tokenId = new BN(1)
        await expect(mint(tokenId, new BN(0), owner, undefined, recipient)).to.be.rejectedWith(/Token id not supported/)
      })
    })

    describe("validation of mint amount", () => {
      it("rejects duplicative minting, i.e. where amount before minting is > 0", async () => {
        await mint(tokenId, new BN(0), owner, undefined, recipient)
        expect(await uniqueIdentity.balanceOf(recipient, new BN(0))).to.bignumber.equal(new BN(1))
        await expect(mint(tokenId, new BN(1), owner, undefined, recipient)).to.be.rejectedWith(
          /Balance before mint must be 0/
        )
      })
    })

    it("updates state and emits an event", async () => {
      await expect(mint(tokenId, new BN(0), owner, undefined, recipient)).to.be.fulfilled
      // (State updates and event emitted are established in `mint()`.)
    })

    it("uses the expected amount of gas", async () => {
      const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, uniqueIdentity.address]
      const signature = await sign(owner, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
      const mintParams: MintParams = [tokenId, timestamp]
      const receipt = await uniqueIdentity.mint(...mintParams, signature, {
        from: recipient,
        value: MINT_PAYMENT,
      })
      const tolerance = new BN(50)
      expect(new BN(receipt.receipt.gasUsed)).to.bignumber.closeTo(new BN(88435), tolerance)
    })

    context("paused", () => {
      it("reverts", async () => {
        await pause()
        await expect(mint(tokenId, new BN(0), owner, undefined, recipient)).to.be.rejectedWith(
          /ERC1155Pausable: token transfer while paused/
        )
      })
    })
  })

  describe("mintTo", () => {
    let recipient: string, from: string, tokenId: BN, timestamp: BN

    beforeEach(async () => {
      recipient = anotherUser
      from = anotherUser2
      tokenId = new BN(0)
      await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
      timestamp = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
    })

    describe("validates signature", () => {
      it("rejects incorrect `id` in hashed message", async () => {
        const incorrectId = tokenId.add(new BN(1))
        await expect(
          mintTo(recipient, tokenId, new BN(0), owner, from, [recipient, incorrectId, timestamp])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect chain id in hashed message", async () => {
        const chainId = await hre.getChainId()
        expect(chainId).to.bignumber.equal(new BN(31337))
        const incorrectChainId = new BN(1)
        await expect(
          mintTo(recipient, tokenId, new BN(0), owner, from, undefined, incorrectChainId)
        ).to.be.rejectedWith(/Invalid signer/)
      })

      it("rejects incorrect recipient in hashed message", async () => {
        await expect(
          mintTo(anotherUser3, tokenId, new BN(0), owner, from, [recipient, tokenId, timestamp])
        ).to.be.rejectedWith(/Invalid signer/)
      })

      it("rejects incorrect msg sender in hashed message", async () => {
        const mintToParams: MintToParams = [recipient, tokenId, timestamp]
        const messageElements: [string, string, BN, BN, string] = [
          from,
          recipient,
          tokenId,
          timestamp,
          uniqueIdentity.address,
        ]
        const signature = await sign(owner, {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        await expect(
          uniqueIdentity.mintTo(...mintToParams, signature, {
            from: anotherUser3,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })

      it("allows address with signer role", async () => {
        expect(await uniqueIdentity.hasRole(SIGNER_ROLE, owner)).to.equal(true)
        await expect(mintTo(recipient, tokenId, new BN(0), owner, from)).to.be.fulfilled
      })
      it("rejects address without signer role", async () => {
        expect(await uniqueIdentity.hasRole(SIGNER_ROLE, recipient)).to.equal(false)
        await expect(mintTo(recipient, tokenId, new BN(0), recipient, from, undefined)).to.be.rejectedWith(
          /Invalid signer/
        )
      })
      it("rejects an expired timestamp", async () => {
        timestamp = (await getCurrentTimestamp()).sub(SECONDS_PER_DAY)
        await expect(
          mintTo(recipient, tokenId, new BN(0), owner, from, [recipient, tokenId, timestamp])
        ).to.be.rejectedWith(/Signature has expired/)
      })
      it("rejects empty signature", async () => {
        const emptySignature = EMPTY_STRING_HEX
        const mintToParams: MintToParams = [recipient, tokenId, timestamp]
        await expect(
          uniqueIdentity.mintTo(...mintToParams, emptySignature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/ECDSA: invalid signature length/)
      })
      it("rejects an incorrect contract address", async () => {
        const messageElements: [string, string, BN, BN, string] = [
          from,
          recipient,
          tokenId,
          timestamp,
          uniqueIdentity.address,
        ]
        const signature = await sign(owner, {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintToParams: MintToParams = [recipient, tokenId, timestamp]
        await expect(
          uniqueIdentity.mintTo(...mintToParams, signature, {
            from: recipient,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects reuse of a signature", async () => {
        const messageElements: [string, string, BN, BN, string] = [
          from,
          recipient,
          tokenId,
          timestamp,
          uniqueIdentity.address,
        ]
        const signature = await sign(owner, {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintToParams: MintToParams = [recipient, tokenId, timestamp]
        await uniqueIdentity.mintTo(...mintToParams, signature, {
          from,
          value: MINT_PAYMENT,
        })
        await expect(
          uniqueIdentity.mintTo(...mintToParams, signature, {
            from,
            value: MINT_PAYMENT,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
    })

    describe("requires payment", () => {
      it("rejects insufficient payment", async () => {
        const messageElements: [string, string, BN, BN, string] = [
          from,
          recipient,
          tokenId,
          timestamp,
          uniqueIdentity.address,
        ]
        const signature = await sign(owner, {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintToParams: MintToParams = [recipient, tokenId, timestamp]
        await expect(
          uniqueIdentity.mintTo(...mintToParams, signature, {
            from,
            value: MINT_PAYMENT.sub(new BN(1)),
          })
        ).to.be.rejectedWith(/Token mint requires 0\.00083 ETH/)
      })
      it("accepts minimum payment", async () => {
        const messageElements: [string, string, BN, BN, string] = [
          from,
          recipient,
          tokenId,
          timestamp,
          uniqueIdentity.address,
        ]
        const signature = await sign(owner, {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintToParams: MintToParams = [recipient, tokenId, timestamp]
        await expect(
          uniqueIdentity.mintTo(...mintToParams, signature, {
            from,
            value: MINT_PAYMENT,
          })
        ).to.be.fulfilled
      })
      it("accepts overpayment", async () => {
        const messageElements: [string, string, BN, BN, string] = [
          from,
          recipient,
          tokenId,
          timestamp,
          uniqueIdentity.address,
        ]
        const signature = await sign(owner, {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const mintToParams: MintToParams = [recipient, tokenId, timestamp]
        await expect(
          uniqueIdentity.mintTo(...mintToParams, signature, {
            from,
            value: MINT_PAYMENT.add(new BN(1)),
          })
        ).to.be.fulfilled
      })
    })

    describe("validates id", () => {
      beforeEach(async () => {
        await uniqueIdentity.setSupportedUIDTypes([0, 1], [true, false])
      })

      it("allows token id of 0", async () => {
        const tokenId = new BN(0)
        await expect(mintTo(recipient, tokenId, new BN(0), owner, from)).to.be.fulfilled
      })
      it("rejects token id > 0", async () => {
        const tokenId = new BN(1)
        await expect(mintTo(recipient, tokenId, new BN(0), owner, from)).to.be.rejectedWith(/Token id not supported/)
      })
    })

    describe("validation of mint amount", () => {
      it("rejects duplicative minting, i.e. where amount before minting is > 0", async () => {
        await mintTo(recipient, tokenId, new BN(0), owner, from)
        expect(await uniqueIdentity.balanceOf(recipient, new BN(0))).to.bignumber.equal(new BN(1))
        await expect(mintTo(recipient, tokenId, new BN(1), owner, from)).to.be.rejectedWith(
          /Balance before mint must be 0/
        )
      })

      it("rejects duplicate minting by msgSender where msgSender has a UID of the given type already", async () => {
        await mint(tokenId, new BN(0), owner, undefined, from)
        expect(await uniqueIdentity.balanceOf(from, tokenId)).to.bignumber.equal(new BN(1))
        expect(await uniqueIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(0))
        await expect(mintTo(recipient, tokenId, new BN(1), owner, from)).to.be.rejectedWith(
          /msgSender already owns UID/
        )
      })
    })

    it("updates state and emits an event", async () => {
      await expect(mintTo(recipient, tokenId, new BN(0), owner, from)).to.be.fulfilled
      // (State updates and event emitted are established in `mint()`.)
    })

    it("uses the expected amount of gas", async () => {
      const messageElements: [string, string, BN, BN, string] = [
        from,
        recipient,
        tokenId,
        timestamp,
        uniqueIdentity.address,
      ]
      const signature = await sign(owner, {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
      const mintToParams: MintToParams = [recipient, tokenId, timestamp]
      const receipt = await uniqueIdentity.mintTo(...mintToParams, signature, {
        from,
        value: MINT_PAYMENT,
      })
      const tolerance = new BN(50)
      expect(new BN(receipt.receipt.gasUsed)).to.bignumber.closeTo(new BN(93704), tolerance)
    })

    context("paused", () => {
      it("reverts", async () => {
        await pause()
        await expect(mintTo(recipient, tokenId, new BN(0), owner, from)).to.be.rejectedWith(
          /ERC1155Pausable: token transfer while paused/
        )
      })
    })
  })
})
