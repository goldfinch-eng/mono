/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
import {DepositMade} from "../typechain/truffle/SeniorPool"
import {
  bigVal,
  decodeLogs,
  deployAllContracts,
  erc20Approve,
  erc20Transfer,
  expect,
  getFirstLog,
  usdcVal,
} from "./testHelpers"
import {GFIInstance, CommunityRewardsInstance} from "../typechain/truffle"
import {Granted} from "../typechain/truffle/CommunityRewards"
const {ethers} = hre
const {deployments} = hre

describe("CommunityRewards", () => {
  let owner: string, anotherUser: string, gfi: GFIInstance, communityRewards: CommunityRewardsInstance

  beforeEach(async () => {
    ;[owner, anotherUser] = await web3.eth.getAccounts()
    ;({gfi, communityRewards} = await deployAllContracts(deployments))
  })

  async function grant({
    recipient,
    amount,
    vestingLength,
    cliffLength,
    vestingInterval,
  }: {
    recipient: string
    amount: BN
    vestingLength: BN
    cliffLength: BN
    vestingInterval: BN
  }): Promise<BN> {
    const receipt = await communityRewards.grant(recipient, amount, vestingLength, cliffLength, vestingInterval, {
      from: owner,
    })
    const grantedEvent = getFirstLog<Granted>(decodeLogs(receipt.receipt.rawLogs, communityRewards, "Granted"))

    // Verify event has correct fields
    expect(grantedEvent.args.user).to.equal(recipient)
    expect(grantedEvent.args.amount).to.bignumber.equal(amount)
    expect(grantedEvent.args.vestingLength).to.bignumber.equal(vestingLength)
    expect(grantedEvent.args.cliffLength).to.bignumber.equal(cliffLength)
    expect(grantedEvent.args.vestingInterval).to.bignumber.equal(vestingInterval)

    return grantedEvent.args.tokenId
  }

  async function mintAndLoadRewards(amount: BN) {
    await gfi.mint(owner, amount)
    await gfi.approve(communityRewards.address, amount)
    await communityRewards.loadRewards(amount)
  }

  describe("grant", () => {
    beforeEach(async () => {})

    it("rejects sender who lacks admin role", async () => {})

    it("rejects 0 grant amount", async () => {})

    it("allows 0 vesting length", async () => {})

    it("rejects a cliff length that exceeds vesting length", async () => {})

    it("rejects a vesting interval of 0", async () => {})

    it("rejects a vesting interval that is not a factor of vesting length", async () => {})

    it("rejects granting an amount that exceeds the available rewards", async () => {})

    it("updates state, mints an NFT owned by the grant recipient, and emits an event", async () => {})

    context("paused", async () => {
      it("reverts", async () => {
        await communityRewards.pause()
        await expect(
          communityRewards.grant(anotherUser, new BN(1000), new BN(0), new BN(0), new BN(1), {from: owner})
        ).to.be.rejectedWith(/paused/)
      })
    })

    context("reentrancy", async () => {
      it("reverts", async () => {})
    })
  })

  describe("loadRewards", async () => {
    it("rejects sender who lacks admin role", async () => {})

    it("rejects 0 amount", async () => {})

    it("transfers GFI from sender, updates state, and emits an event", async () => {})
  })

  describe("revokeGrant", async () => {
    it("rejects sender who lacks admin role", async () => {})

    it("rejects call for a non-existent token id", async () => {})

    it("rejects if grant has already been revoked", async () => {})

    it("rejects if grant has already fully vested", async () => {})

    it("updates state and emits an event", async () => {})

    context("paused", async () => {
      it("reverts", async () => {
        const amount = new BN(1000)
        await mintAndLoadRewards(amount)
        const tokenId = await grant({
          recipient: anotherUser,
          amount: amount,
          vestingLength: new BN(0),
          cliffLength: new BN(0),
          vestingInterval: new BN(1),
        })
        await communityRewards.pause()
        await expect(communityRewards.revokeGrant(tokenId, {from: owner})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("getReward", async () => {
    it("rejects sender who is not owner of the token", async () => {})

    it("allows call if claimable amount is 0", async () => {})

    it("updates state, transfers rewards, and emits an event, if claimable amount is > 0", async () => {})

    context("grant with 0 vesting length", async () => {
      it("gets full grant amount", async () => {})
    })

    context("grant with > 0 vesting length, 0 cliff", async () => {
      it("gets the vested amount", async () => {})
    })

    context("grant with vesting interval of 1", async () => {
      it("gets the vested amount", async () => {})
    })

    context("grant with vesting interval > 1", async () => {
      it("gets full grant amount", async () => {})
    })

    context("grant with vesting interval > 1", async () => {
      it("gets full grant amount", async () => {})
    })

    context("grant with > 0 cliff", async () => {
      it("gets 0 before cliff has elapsed", async () => {})

      it("gets vested amount after cliff has elapsed", async () => {})
    })

    context("revoked grant", async () => {
      it("after revocation, vested amount is still claimable", async () => {})

      it("after revocation, no further amount vests, so no further amount is claimable", async () => {})
    })

    context("paused", async () => {
      it("reverts", async () => {
        const amount = new BN(1000)
        await mintAndLoadRewards(amount)
        const tokenId = await grant({
          recipient: anotherUser,
          amount,
          vestingLength: new BN(0),
          cliffLength: new BN(0),
          vestingInterval: new BN(1),
        })
        await communityRewards.pause()
        await expect(communityRewards.getReward(tokenId, {from: anotherUser})).to.be.rejectedWith(/paused/)
      })
    })

    context("reentrancy", async () => {
      it("reverts", async () => {})
    })
  })
})
