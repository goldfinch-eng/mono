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
import {UNIQUE_IDENTITY_METADATA_URI} from "../blockchain_scripts/uniqueIdentity/constants"
import {TestUniqueIdentity} from "../typechain/ethers"
import {TestUniqueIdentityInstance} from "../typechain/truffle/TestUniqueIdentity"
import {
  BurnParams,
  BURN_MESSAGE_ELEMENT_TYPES,
  EMPTY_STRING_HEX,
  MintParams,
  MINT_MESSAGE_ELEMENT_TYPES,
  MINT_PAYMENT,
} from "./uniqueIdentityHelpers"
import {getCurrentTimestamp, SECONDS_PER_DAY} from "./testHelpers"
import {mint as mintHelper, burn as burnHelper, sign as signHelper} from "./uniqueIdentityHelpers"
import {deployBaseFixture} from "./util/fixtures"
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  const {deploy} = deployments
  const [_owner, _anotherUser, _anotherUser2, _anotherUser3] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const anotherUser = asNonNullable(_anotherUser)
  const anotherUser2 = asNonNullable(_anotherUser2)
  const uninitializedUniqueIdentityDeployer = asNonNullable(_anotherUser3)

  const deployed = await deployBaseFixture()

  const uniqueIdentity = deployed.uniqueIdentity

  const uninitializedUniqueIdentityDeployResult = await deploy("TestUniqueIdentity", {
    from: uninitializedUniqueIdentityDeployer,
    gasLimit: 4000000,
  })
  const uninitializedUniqueIdentity = await getContract<TestUniqueIdentity, TestUniqueIdentityInstance>(
    "TestUniqueIdentity",
    TRUFFLE_CONTRACT_PROVIDER,
    {
      at: uninitializedUniqueIdentityDeployResult.address,
    }
  )

  return {
    owner,
    anotherUser,
    anotherUser2,
    uniqueIdentity,
    uninitializedUniqueIdentity,
    uninitializedUniqueIdentityDeployer,
  }
})

describe("UniqueIdentity", () => {
  let owner: string,
    anotherUser: string,
    anotherUser2: string,
    uniqueIdentity: TestUniqueIdentityInstance,
    uninitializedUniqueIdentityDeployer: string,
    uninitializedUniqueIdentity: TestUniqueIdentityInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      anotherUser,
      anotherUser2,
      uniqueIdentity,
      uninitializedUniqueIdentityDeployer,
      uninitializedUniqueIdentity,
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

  describe("initialize", () => {
    it("rejects zero address owner", async () => {
      const initialized = uninitializedUniqueIdentity.initialize(
        ethersConstants.AddressZero,
        UNIQUE_IDENTITY_METADATA_URI
      )
      await expect(initialized).to.be.rejectedWith(/Owner address cannot be empty/)
    })
    it("grants owner the owner, pauser, and signer roles", async () => {
      expect(await uniqueIdentity.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await uniqueIdentity.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await uniqueIdentity.hasRole(SIGNER_ROLE, owner)).to.equal(true)
    })
    it("does not grant the deployer the owner, pauser, nor signer roles", async () => {
      await uninitializedUniqueIdentity.initialize(owner, UNIQUE_IDENTITY_METADATA_URI, {
        from: uninitializedUniqueIdentityDeployer,
      })
      expect(await uniqueIdentity.hasRole(OWNER_ROLE, uninitializedUniqueIdentityDeployer)).to.equal(false)
      expect(await uniqueIdentity.hasRole(PAUSER_ROLE, uninitializedUniqueIdentityDeployer)).to.equal(false)
      expect(await uniqueIdentity.hasRole(SIGNER_ROLE, uninitializedUniqueIdentityDeployer)).to.equal(false)
    })
    it("cannot be called twice", async () => {
      await uninitializedUniqueIdentity.initialize(owner, UNIQUE_IDENTITY_METADATA_URI, {
        from: uninitializedUniqueIdentityDeployer,
      })
      await expect(
        uninitializedUniqueIdentity.initialize(anotherUser2, UNIQUE_IDENTITY_METADATA_URI, {
          from: uninitializedUniqueIdentityDeployer,
        })
      ).to.be.rejectedWith(/Initializable: contract is already initialized/)
    })
    it("zero-address lacks signer role", async () => {
      expect(await uniqueIdentity.hasRole(SIGNER_ROLE, ethersConstants.AddressZero)).to.equal(false)
    })
  })

  describe("name and symbol", () => {
    it("Returns correct values", async () => {
      expect(await uniqueIdentity.name()).to.equal("Unique Identity")
      expect(await uniqueIdentity.symbol()).to.equal("UID")
    })
  })

  describe("setSupportedUIDTypes", () => {
    it("requires sender to be admin", async () => {
      expect(await uniqueIdentity.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      await expect(uniqueIdentity.setSupportedUIDTypes([], [], {from: anotherUser})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })

    it("checks the length of ids and values is equivalent", async () => {
      await expect(uniqueIdentity.setSupportedUIDTypes([1], [])).to.be.rejectedWith(/accounts and ids length mismatch/)
      await expect(uniqueIdentity.setSupportedUIDTypes([], [true])).to.be.rejectedWith(
        /accounts and ids length mismatch/
      )
    })

    it("properly sets supportedUIDTypes", async () => {
      await uniqueIdentity.setSupportedUIDTypes([0, 1], [true, true])
      expect(await uniqueIdentity.supportedUIDTypes(0)).to.equal(true)
      expect(await uniqueIdentity.supportedUIDTypes(1)).to.equal(true)
      await uniqueIdentity.setSupportedUIDTypes([0, 1], [true, false])
      expect(await uniqueIdentity.supportedUIDTypes(1)).to.equal(false)
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

  describe("setURI", () => {
    const NEW_URI = "https://example.com"

    it("allows sender who has owner role", async () => {
      expect(await uniqueIdentity.hasRole(OWNER_ROLE, owner)).to.equal(true)
      await expect(uniqueIdentity.setURI(NEW_URI, {from: owner})).to.be.fulfilled
    })

    it("rejects sender who lacks owner role", async () => {
      expect(await uniqueIdentity.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      await expect(uniqueIdentity.setURI(NEW_URI, {from: anotherUser})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })

    it("updates state but does not emit an event", async () => {
      const tokenId = new BN(0)
      const uriBefore = await uniqueIdentity.uri(tokenId)
      expect(uriBefore).to.equal(UNIQUE_IDENTITY_METADATA_URI)
      const receipt = await uniqueIdentity.setURI(NEW_URI, {from: owner})
      const uriAfter = await uniqueIdentity.uri(tokenId)
      expect(uriAfter).to.equal(NEW_URI)
      expectEvent.notEmitted(receipt, "URI")
    })

    context("paused", () => {
      it("allows anyway", async () => {
        await pause()
        await expect(uniqueIdentity.setURI(NEW_URI)).to.be.fulfilled
      })
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
      expect(new BN(receipt.receipt.gasUsed)).to.bignumber.closeTo(new BN(88377), tolerance)
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

  describe("safeTransferFrom", () => {
    let tokenId: BN

    beforeEach(async () => {
      tokenId = new BN(0)
      await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
      await mint(tokenId, new BN(0), owner, undefined, anotherUser)
    })

    describe("by token owner", () => {
      it("rejects because transfer is disabled", async () => {
        const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
        await expect(
          uniqueIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
            from: anotherUser,
          })
        ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
          await expect(
            uniqueIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
              from: anotherUser,
            })
          ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
        })
      })
    })

    describe("by approved sender who is not token owner", () => {
      it("rejects because transfer is disabled", async () => {
        await uniqueIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
        expect(await uniqueIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
        const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
        await expect(
          uniqueIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
            from: anotherUser2,
          })
        ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          await uniqueIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
          expect(await uniqueIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
          const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
          await expect(
            uniqueIdentity.safeTransferFrom(anotherUser, anotherUser2, tokenId, amount, EMPTY_STRING_HEX, {
              from: anotherUser2,
            })
          ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
        })
      })
    })
  })

  describe("safeBatchTransferFrom", () => {
    let tokenId: BN

    beforeEach(async () => {
      tokenId = new BN(0)
      await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
      await mint(tokenId, new BN(0), owner, undefined, anotherUser)
    })

    describe("by token owner", () => {
      it("rejects because transfer is disabled", async () => {
        const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
        await expect(
          uniqueIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
            from: anotherUser,
          })
        ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
          await expect(
            uniqueIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
              from: anotherUser,
            })
          ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
        })
      })
    })

    describe("by approved sender who is not token owner", () => {
      it("rejects because transfer is disabled", async () => {
        await uniqueIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
        expect(await uniqueIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
        const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
        await expect(
          uniqueIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
            from: anotherUser2,
          })
        ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
      })

      context("paused", () => {
        it("reverts", async () => {
          await pause()
          await uniqueIdentity.setApprovalForAll(anotherUser2, true, {from: anotherUser})
          expect(await uniqueIdentity.isApprovedForAll(anotherUser, anotherUser2)).to.equal(true)
          const amount = await uniqueIdentity.balanceOf(anotherUser, tokenId)
          await expect(
            uniqueIdentity.safeBatchTransferFrom(anotherUser, anotherUser2, [tokenId], [amount], EMPTY_STRING_HEX, {
              from: anotherUser2,
            })
          ).to.be.rejectedWith(/Only mint or burn transfers are allowed/)
        })
      })
    })
  })

  describe("burn", () => {
    let recipient: string, tokenId: BN, timestamp: BN

    beforeEach(async () => {
      recipient = anotherUser
      tokenId = new BN(0)
      await uniqueIdentity.setSupportedUIDTypes([tokenId], [true])
      timestamp = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)

      await mint(tokenId, new BN(0), owner, undefined, recipient)
    })

    describe("validates signature", () => {
      it("rejects incorrect `to` address in hashed message", async () => {
        const incorrectTo = owner
        await expect(burn(recipient, tokenId, new BN(1), owner, [incorrectTo, tokenId, timestamp])).to.be.rejectedWith(
          /Invalid signer/
        )
      })
      it("rejects incorrect `id` in hashed message", async () => {
        const incorrectId = tokenId.add(new BN(1))
        await expect(
          burn(recipient, tokenId, new BN(1), owner, [recipient, incorrectId, timestamp])
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects incorrect chain id in hashed message", async () => {
        const chainId = await hre.getChainId()
        expect(chainId).to.bignumber.equal(new BN(31337))
        const incorrectChainId = new BN(1)
        await expect(
          burn(recipient, tokenId, new BN(1), owner, undefined, undefined, incorrectChainId)
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("allows address with signer role", async () => {
        expect(await uniqueIdentity.hasRole(SIGNER_ROLE, owner)).to.equal(true)
        await expect(burn(recipient, tokenId, new BN(1), owner)).to.be.fulfilled
      })
      it("rejects address without signer role", async () => {
        expect(await uniqueIdentity.hasRole(SIGNER_ROLE, recipient)).to.equal(false)
        await expect(burn(recipient, tokenId, new BN(1), recipient)).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects an expired timestamp", async () => {
        timestamp = (await getCurrentTimestamp()).sub(SECONDS_PER_DAY)
        await expect(burn(recipient, tokenId, new BN(0), owner, [recipient, tokenId, timestamp])).to.be.rejectedWith(
          /Signature has expired/
        )
      })
      it("rejects empty signature", async () => {
        const emptySignature = EMPTY_STRING_HEX
        const burnParams: BurnParams = [recipient, tokenId, timestamp]
        await expect(
          uniqueIdentity.burn(...burnParams, emptySignature, {
            from: recipient,
          })
        ).to.be.rejectedWith(/ECDSA: invalid signature length/)
      })
      it("rejects an incorrect contract address", async () => {
        const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, owner]
        const signature = await sign(owner, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(1))
        const burnParams: BurnParams = [recipient, tokenId, timestamp]
        await expect(
          uniqueIdentity.burn(...burnParams, signature, {
            from: recipient,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("rejects reuse of a signature", async () => {
        const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, uniqueIdentity.address]
        const signature = await sign(owner, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(1))
        const burnParams: BurnParams = [recipient, tokenId, timestamp]
        await uniqueIdentity.burn(...burnParams, signature, {
          from: recipient,
        })
        await expect(
          uniqueIdentity.burn(...burnParams, signature, {
            from: recipient,
          })
        ).to.be.rejectedWith(/Invalid signer/)
      })
      it("allows any sender bearing a valid signature", async () => {
        await expect(burn(recipient, tokenId, new BN(1), owner, undefined, anotherUser2)).to.be.fulfilled
      })
    })

    describe("validates account", () => {
      it("rejects zero-address", async () => {
        const messageElements: [string, BN, BN, string] = [
          ethersConstants.AddressZero,
          tokenId,
          timestamp,
          uniqueIdentity.address,
        ]
        const signature = await sign(owner, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(0))
        const burnParams: BurnParams = [ethersConstants.AddressZero, tokenId, timestamp]
        await expect(
          uniqueIdentity.burn(...burnParams, signature, {
            from: recipient,
          })
        ).to.be.rejectedWith(/ERC1155: burn from the zero address/)
      })
      it("allows account having token id", async () => {
        expect(await uniqueIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(1))
        await expect(burn(recipient, tokenId, new BN(1), owner)).to.be.fulfilled
      })
      it("rejects account not having token id", async () => {
        expect(await uniqueIdentity.balanceOf(anotherUser2, tokenId)).to.bignumber.equal(new BN(0))
        await expect(burn(anotherUser2, tokenId, new BN(0), owner)).to.be.rejectedWith(
          /ERC1155: burn amount exceeds balance/
        )
      })
    })

    describe("validates id", () => {
      it("allows for token id for which minting is supported", async () => {
        await expect(burn(recipient, tokenId, new BN(1), owner)).to.be.fulfilled
      })
      it("allows for token id for which minting is not supported", async () => {
        // Retaining the ability to burn a token of id for which minting is not supported is useful for at least two reasons:
        // (1) in case such tokens should never have been mintable but were somehow minted; (2) in case we have deprecated
        // the ability to mint tokens of that id.
        const unsupportedTokenId = tokenId.add(new BN(3))
        expect(await uniqueIdentity.balanceOf(recipient, unsupportedTokenId)).to.bignumber.equal(new BN(0))
        await expect(mint(unsupportedTokenId, new BN(1), owner, undefined, recipient)).to.be.rejectedWith(
          /Token id not supported/
        )
        const value = new BN(1)
        await uniqueIdentity._mintForTest(recipient, unsupportedTokenId, value, EMPTY_STRING_HEX, {from: owner})
        expect(await uniqueIdentity.balanceOf(recipient, unsupportedTokenId)).to.bignumber.equal(value)
        await expect(burn(recipient, unsupportedTokenId, new BN(2), owner)).to.be.fulfilled
      })
    })

    describe("validation of burn value", () => {
      it("rejects burn value less than amount on token", async () => {
        // The value in having this test is that it shows that the contract's burn function explicitly requires that
        // the entire balance have been burned.
        //
        // An implication of the behavior established by this test is, if the case ever arises in practice where a token
        // balance becomes > 1 (e.g. due to a bug or hack), we'd need to upgrade the contract to be able to burn that token.
        const unsupportedValue = new BN(2)
        expect(await uniqueIdentity.balanceOf(anotherUser2, tokenId)).to.bignumber.equal(new BN(0))
        await uniqueIdentity._mintForTest(anotherUser2, tokenId, unsupportedValue, EMPTY_STRING_HEX, {from: owner})
        expect(await uniqueIdentity.balanceOf(anotherUser2, tokenId)).to.bignumber.equal(unsupportedValue)
        await expect(burn(anotherUser2, tokenId, new BN(1), owner)).to.be.rejectedWith(/Balance after burn must be 0/)
      })
      it("rejects burn value greater than amount on token", async () => {
        expect(await uniqueIdentity.balanceOf(anotherUser2, tokenId)).to.bignumber.equal(new BN(0))
        await expect(burn(anotherUser2, tokenId, new BN(0), owner)).to.be.rejectedWith(
          /ERC1155: burn amount exceeds balance/
        )
      })
      it("allows burn value that equals amount on token", async () => {
        expect(await uniqueIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(1))
        await expect(burn(recipient, tokenId, new BN(1), owner)).to.be.fulfilled
        expect(await uniqueIdentity.balanceOf(recipient, tokenId)).to.bignumber.equal(new BN(0))
      })
    })

    it("updates state and emits an event", async () => {
      await expect(burn(recipient, tokenId, new BN(1), owner)).to.be.fulfilled
      // (State updates and event emitted are established in `burn()`.)
    })

    it("uses the expected amount of gas", async () => {
      const messageElements: [string, BN, BN, string] = [recipient, tokenId, timestamp, uniqueIdentity.address]
      const signature = await sign(owner, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, new BN(1))
      const burnParams: BurnParams = [recipient, tokenId, timestamp]
      const receipt = await uniqueIdentity.burn(...burnParams, signature, {
        from: recipient,
      })
      const tolerance = new BN(50)
      expect(new BN(receipt.receipt.gasUsed)).to.bignumber.closeTo(new BN(47598), tolerance)
    })

    context("paused", () => {
      it("reverts", async () => {
        await pause()
        await expect(burn(recipient, tokenId, new BN(1), owner)).to.be.rejectedWith(
          /ERC1155Pausable: token transfer while paused/
        )
      })
    })
  })
})
