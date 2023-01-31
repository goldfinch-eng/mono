/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
import {expectEvent} from "@openzeppelin/test-helpers"
import {DISTRIBUTOR_ROLE, OWNER_ROLE} from "../blockchain_scripts/deployHelpers"
import {GFIInstance} from "../typechain/truffle"
import {
  CommunityRewardsInstance,
  Granted,
  GrantRevoked,
  RewardAdded,
  RewardPaid,
} from "../typechain/truffle/contracts/rewards/CommunityRewards"
import {
  assertCommunityRewardsVestingRewards,
  expectStateAfterGetReward,
  mintAndLoadRewards,
} from "./communityRewardsHelpers"
import {advanceTime, decodeLogs, expect, getCurrentTimestamp, getOnlyLog} from "./testHelpers"
import {asNonNullable} from "../../utils/src"
import {TOKEN_LAUNCH_TIME_IN_SECONDS} from "../blockchain_scripts/baseDeploy"
import {deployBaseFixture} from "./util/fixtures"
const {ethers} = hre
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  const [_owner, _anotherUser] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const anotherUser = asNonNullable(_anotherUser)

  const deployed = await deployBaseFixture()
  return {owner, anotherUser, ...deployed}
})

const THREE_YEARS_IN_SECONDS = 365 * 24 * 60 * 60 * 3
const TOKEN_LAUNCH_TIME = new BN(TOKEN_LAUNCH_TIME_IN_SECONDS).add(new BN(THREE_YEARS_IN_SECONDS))

describe("CommunityRewards", () => {
  let owner: string, anotherUser: string, gfi: GFIInstance, communityRewards: CommunityRewardsInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, anotherUser, gfi, communityRewards} = await setupTest())
    await communityRewards.setTokenLaunchTimeInSeconds(TOKEN_LAUNCH_TIME)
    await advanceTime({toSecond: TOKEN_LAUNCH_TIME})
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
    const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)

    const rewardsAvailableBefore = await communityRewards.rewardsAvailable()

    const receipt = await communityRewards.grant(recipient, amount, vestingLength, cliffLength, vestingInterval, {
      from: owner,
    })

    const contractGfiBalanceAfter = await gfi.balanceOf(communityRewards.address)

    const rewardsAvailableAfter = await communityRewards.rewardsAvailable()

    const grantedEvent = getOnlyLog<Granted>(decodeLogs(receipt.receipt.rawLogs, communityRewards, "Granted"))
    const tokenId = grantedEvent.args.tokenId

    // Verify contract GFI balance.
    expect(contractGfiBalanceBefore).to.bignumber.equal(contractGfiBalanceAfter)

    // Verify rewards available state.
    expect(rewardsAvailableBefore.sub(rewardsAvailableAfter)).to.bignumber.equal(amount)

    // Verify grant state.
    const expectedStartTime = new BN(TOKEN_LAUNCH_TIME)
    const grantState = await communityRewards.grants(tokenId)
    assertCommunityRewardsVestingRewards(grantState)
    expect(grantState.totalGranted).to.bignumber.equal(amount)
    expect(grantState.totalClaimed).to.bignumber.equal(new BN(0))
    expect(grantState.startTime).to.bignumber.equal(expectedStartTime)
    expect(grantState.endTime).to.bignumber.equal(new BN(grantState.startTime).add(vestingLength))
    expect(grantState.cliffLength).to.bignumber.equal(cliffLength)
    if (vestingInterval.isZero()) {
      expect(grantState.vestingInterval).to.bignumber.equal(vestingLength)
    } else {
      expect(grantState.vestingInterval).to.bignumber.equal(vestingInterval)
    }
    expect(grantState.revokedAt).to.bignumber.equal(new BN(0))

    // Verify that NFT was minted that is owned by recipient.
    expect(await communityRewards.ownerOf(tokenId)).to.equal(anotherUser)

    // Verify that event was emitted.
    expect(grantedEvent.args.user).to.equal(recipient)
    expect(grantedEvent.args.amount).to.bignumber.equal(amount)
    expect(grantedEvent.args.vestingLength).to.bignumber.equal(vestingLength)
    expect(grantedEvent.args.cliffLength).to.bignumber.equal(cliffLength)

    if (vestingInterval.isZero()) {
      expect(grantedEvent.args.vestingInterval).to.bignumber.equal(vestingLength)
    } else {
      expect(grantedEvent.args.vestingInterval).to.bignumber.equal(vestingInterval)
    }

    return new BN(tokenId)
  }

  it("sets tokenLaunchTimeInSeconds to TOKEN_LAUNCH_TIME by default", async () => {
    expect(await communityRewards.tokenLaunchTimeInSeconds()).to.bignumber.eq(new BN(TOKEN_LAUNCH_TIME))
  })

  describe("setTokenLaunchTimeInSeconds", async () => {
    it("sets tokenLaunchTimeInSeconds", async () => {
      await communityRewards.setTokenLaunchTimeInSeconds("47")
      expect(await communityRewards.tokenLaunchTimeInSeconds()).to.bignumber.eq("47")
    })

    it("rejects sender who lacks owner role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      await expect(communityRewards.setTokenLaunchTimeInSeconds(47, {from: anotherUser})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })
  })

  describe("grants", () => {
    it("returns the state for a grant", async () => {
      const amount = new BN(1e6)
      const vestingLength = new BN(1000)
      const cliffLength = new BN(500)
      const vestingInterval = new BN(100)
      await mintAndLoadRewards(gfi, communityRewards, owner, amount)
      const tokenId = await grant({
        recipient: anotherUser,
        amount,
        vestingLength,
        cliffLength,
        vestingInterval,
      })
      const expectedStartTime = new BN(TOKEN_LAUNCH_TIME)
      const grantState = await communityRewards.grants(tokenId)
      assertCommunityRewardsVestingRewards(grantState)
      expect(grantState.totalGranted).to.bignumber.equal(amount)
      expect(grantState.totalClaimed).to.bignumber.equal(new BN(0))
      expect(grantState.startTime).to.bignumber.equal(expectedStartTime)
      expect(grantState.endTime).to.bignumber.equal(expectedStartTime.add(vestingLength))
      expect(grantState.cliffLength).to.bignumber.equal(cliffLength)
      expect(grantState.vestingInterval).to.bignumber.equal(vestingInterval)
      expect(grantState.revokedAt).to.bignumber.equal(new BN(0))
    })
  })

  describe("claimableRewards", () => {
    it("returns the claimable rewards for a grant", async () => {
      const amount = new BN(1e6)
      await mintAndLoadRewards(gfi, communityRewards, owner, amount)
      const tokenId = await grant({
        recipient: anotherUser,
        amount,
        vestingLength: new BN(0),
        cliffLength: new BN(0),
        vestingInterval: new BN(0),
      })
      const claimable = await communityRewards.claimableRewards(tokenId)
      expect(claimable).to.bignumber.equal(amount)
    })
  })

  describe("total unclaimed", () => {
    it("handles multiple tokens", async () => {
      const amount = new BN(2e6)
      await mintAndLoadRewards(gfi, communityRewards, owner, amount)
      const tokenId = await grant({
        recipient: anotherUser,
        amount: amount.div(new BN(2)),
        vestingLength: new BN(0),
        cliffLength: new BN(0),
        vestingInterval: new BN(0),
      })

      await grant({
        recipient: anotherUser,
        amount: amount.div(new BN(2)),
        vestingLength: new BN(0),
        cliffLength: new BN(0),
        vestingInterval: new BN(0),
      })

      const claimable = await communityRewards.claimableRewards(tokenId)
      expect(claimable).to.bignumber.equal(amount.div(new BN(2)))

      // Total should include both grants
      let totalUnclaimed = await communityRewards.totalUnclaimed(anotherUser)
      expect(totalUnclaimed).to.bignumber.equal(amount)

      // Claim one of them
      await communityRewards.getReward(tokenId, {from: anotherUser})

      // Total should now only include the unclaimed grant
      totalUnclaimed = await communityRewards.totalUnclaimed(anotherUser)
      expect(totalUnclaimed).to.bignumber.equal(amount.div(new BN(2)))
    })
  })

  describe("grant", () => {
    beforeEach(async () => {
      const amount = new BN(1e6)
      await mintAndLoadRewards(gfi, communityRewards, owner, amount)
    })

    it("allows owner who has distributor role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await communityRewards.hasRole(DISTRIBUTOR_ROLE, owner)).to.equal(true)
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(1), new BN(0), new BN(1), {from: owner})).to
        .be.fulfilled
    })

    it("allows non-owner who has distributor role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      expect(await communityRewards.hasRole(DISTRIBUTOR_ROLE, anotherUser)).to.equal(false)
      await communityRewards.grantRole(DISTRIBUTOR_ROLE, anotherUser)
      expect(await communityRewards.hasRole(DISTRIBUTOR_ROLE, anotherUser)).to.equal(true)
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(1), new BN(0), new BN(1), {from: owner})).to
        .be.fulfilled
    })

    it("rejects sender who lacks distributor role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      expect(await communityRewards.hasRole(DISTRIBUTOR_ROLE, anotherUser)).to.equal(false)
      await expect(
        communityRewards.grant(anotherUser, new BN(1e3), new BN(1), new BN(0), new BN(1), {from: anotherUser})
      ).to.be.rejectedWith(/Must have distributor role to perform this action/)
    })

    it("rejects 0 grant amount", async () => {
      await expect(
        communityRewards.grant(anotherUser, new BN(0), new BN(1), new BN(0), new BN(1), {from: owner})
      ).to.be.rejectedWith(/Cannot grant 0 amount/)
    })

    it("rejects a vestingInterval greater than vestingLength", async () => {
      await expect(
        communityRewards.grant(anotherUser, new BN(1e3), new BN(1000), new BN(0), new BN(1001), {from: owner})
      ).to.be.rejectedWith(/Invalid vestingInterval/)
    })

    it("allows 0 vesting length", async () => {
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(1), new BN(0), new BN(1), {from: owner})).to
        .be.fulfilled
    })

    it("allows > 0 vesting length", async () => {
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(100), new BN(0), new BN(1), {from: owner}))
        .to.be.fulfilled
    })

    it("allows 0 cliff length", async () => {
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(1), new BN(0), new BN(1), {from: owner})).to
        .be.fulfilled
    })

    it("allows > 0 cliff length less than vesting length", async () => {
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(100), new BN(10), new BN(1), {from: owner}))
        .to.be.fulfilled
    })

    it("allows > 0 cliff length equal to vesting length", async () => {
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(100), new BN(100), new BN(1), {from: owner}))
        .to.be.fulfilled
    })

    it("rejects a cliff length that exceeds vesting length", async () => {
      await expect(
        communityRewards.grant(anotherUser, new BN(1e3), new BN(0), new BN(1), new BN(1), {from: owner})
      ).to.be.rejectedWith(/Cliff length cannot exceed vesting length/)
    })

    context("vesting interval is 0", async () => {
      it("defaults vesting interval to vesting length", async () => {
        const gfiAmount = new BN(1e3)
        const vestingInterval = new BN(0)
        const vestingLength = new BN(15768000)

        const tokenId = await grant({
          recipient: anotherUser,
          amount: gfiAmount,
          vestingLength,
          cliffLength: new BN(0),
          vestingInterval,
        })

        // Initial claimable should be 0
        let claimable = await communityRewards.claimableRewards(tokenId)
        expect(claimable).to.bignumber.equal(new BN(0))

        await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME).add(vestingLength.div(new BN(2)))})
        await ethers.provider.send("evm_mine", [])

        // Should still be 0
        claimable = await communityRewards.claimableRewards(tokenId)
        expect(claimable).to.bignumber.equal(new BN(0))

        await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME).add(vestingLength)})
        await ethers.provider.send("evm_mine", [])

        // Should be fully claimable
        claimable = await communityRewards.claimableRewards(tokenId)
        expect(claimable).to.bignumber.equal(gfiAmount)

        const gfiBalanceBefore = await gfi.balanceOf(anotherUser)
        expect(gfiBalanceBefore).to.bignumber.eq(new BN(0))

        await communityRewards.getReward(tokenId, {from: anotherUser})
        const gfiBalanceAfter = await gfi.balanceOf(anotherUser)

        expect(gfiBalanceAfter).to.bignumber.eq(gfiAmount)
      })
    })

    it("allows a vesting interval of 1", async () => {
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(1), new BN(0), new BN(1), {from: owner})).to
        .be.fulfilled
    })

    it("allows a > 1 vesting interval that is a factor of vesting length", async () => {
      await expect(communityRewards.grant(anotherUser, new BN(1e3), new BN(6), new BN(0), new BN(3), {from: owner})).to
        .be.fulfilled
    })

    context("> 1 vesting interval is not a factor of vesting length", async () => {
      it("grants the reward, fully claimable in the last whole period", async () => {
        const gfiAmount = new BN(1e3)
        const vestingInterval = new BN(2628000)
        const vestingLength = new BN(21508223)
        // Total periods is 21508223 / 2628000 = 8.184255327245053
        // but grant should be claimable in 8 periods
        const wholePeriodsElapsed = vestingLength.div(vestingInterval)
        expect(wholePeriodsElapsed).to.bignumber.eq(new BN(8))
        const wholePeriodsInSeconds = wholePeriodsElapsed.mul(vestingInterval)

        const tokenId = await grant({
          recipient: anotherUser,
          amount: gfiAmount,
          vestingLength,
          cliffLength: new BN(0),
          vestingInterval,
        })

        await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME).add(wholePeriodsInSeconds)})
        await ethers.provider.send("evm_mine", [])
        const claimable = await communityRewards.claimableRewards(tokenId)
        expect(claimable).to.bignumber.equal(gfiAmount)

        const gfiBalanceBefore = await gfi.balanceOf(anotherUser)
        expect(gfiBalanceBefore).to.bignumber.eq(new BN(0))

        await communityRewards.getReward(tokenId, {from: anotherUser})
        const gfiBalanceAfter = await gfi.balanceOf(anotherUser)

        expect(gfiBalanceAfter).to.bignumber.eq(gfiAmount)
      })
    })

    it("rejects granting an amount that exceeds the available rewards", async () => {
      expect(await communityRewards.rewardsAvailable()).to.bignumber.equal(new BN(1e6))
      await expect(
        communityRewards.grant(anotherUser, new BN(1e6 + 1), new BN(1), new BN(0), new BN(1), {from: owner})
      ).to.be.rejectedWith(/Cannot grant amount due to insufficient funds/)
    })

    it("updates state, mints an NFT owned by the grant recipient, and emits an event", async () => {
      expect(await communityRewards.rewardsAvailable()).to.bignumber.equal(new BN(1e6))

      const tokenId = await grant({
        recipient: anotherUser,
        amount: new BN(1e3),
        vestingLength: new BN(1),
        cliffLength: new BN(0),
        vestingInterval: new BN(1),
      })

      // 1. State updates
      // Decrements available rewards.
      // (Established in `grant()`.)

      // Stores grant state.
      // (Established in `grant()`.)

      // Increments token id.
      const tokenId2 = await grant({
        recipient: anotherUser,
        amount: new BN(1e3),
        vestingLength: new BN(1),
        cliffLength: new BN(0),
        vestingInterval: new BN(1),
      })
      expect(tokenId2).to.bignumber.equal(tokenId.add(new BN(1)))

      // 2. NFT ownership
      // (Established in `grant()`.)

      // 3. Event behavior
      // (Established in `grant()`.)
    })

    it("uses the expected amount of gas", async () => {
      const receipt = await communityRewards.grant(anotherUser, new BN(1e3), new BN(1), new BN(0), new BN(1), {
        from: owner,
      })
      expect(receipt.receipt.gasUsed).to.be.lte(321454)
    })

    context("paused", async () => {
      it("reverts", async () => {
        await communityRewards.pause()
        await expect(
          communityRewards.grant(anotherUser, new BN(1e3), new BN(0), new BN(0), new BN(1), {from: owner})
        ).to.be.rejectedWith(/paused/)
      })
    })

    context("reentrancy", async () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("loadRewards", async () => {
    const amount = new BN(1e3)

    beforeEach(async () => {
      await gfi.mint(owner, amount)
      await gfi.approve(communityRewards.address, amount)
    })

    it("rejects sender who lacks owner role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      await expect(communityRewards.loadRewards(amount, {from: anotherUser})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })

    it("allows sender who has owner role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, owner)).to.equal(true)
      await expect(communityRewards.loadRewards(amount, {from: owner})).to.be.fulfilled
    })

    it("rejects 0 amount", async () => {
      await expect(communityRewards.loadRewards(new BN(0), {from: owner})).to.be.rejectedWith(/Cannot load 0 rewards/)
    })

    it("transfers GFI from sender, updates state, and emits an event", async () => {
      const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
      expect(contractGfiBalanceBefore).to.bignumber.equal(new BN(0))

      const rewardsAvailableBefore = await communityRewards.rewardsAvailable()
      expect(rewardsAvailableBefore).to.bignumber.equal(new BN(0))

      const receipt = await communityRewards.loadRewards(amount, {from: owner})

      const contractGfiBalanceAfter = await gfi.balanceOf(communityRewards.address)
      expect(contractGfiBalanceAfter).to.bignumber.equal(amount)

      const rewardsAvailableAfter = await communityRewards.rewardsAvailable()
      expect(rewardsAvailableAfter).to.bignumber.equal(amount)

      const rewardAddedEvent = getOnlyLog<RewardAdded>(
        decodeLogs(receipt.receipt.rawLogs, communityRewards, "RewardAdded")
      )
      expect(rewardAddedEvent.args.reward).to.bignumber.equal(amount)
    })
  })

  describe("revokeGrant", async () => {
    let tokenId: BN
    let amount: BN
    let vestingLength: BN
    let grantedAt: BN

    beforeEach(async () => {
      amount = new BN(1e6)
      vestingLength = new BN(1000)
      await mintAndLoadRewards(gfi, communityRewards, owner, amount)
      tokenId = await grant({
        recipient: anotherUser,
        amount,
        vestingLength,
        cliffLength: new BN(0),
        vestingInterval: new BN(1),
      })
      grantedAt = new BN(TOKEN_LAUNCH_TIME)
      await advanceTime({toSecond: grantedAt.add(vestingLength.div(new BN(2)))})
    })

    it("rejects sender who lacks owner role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, anotherUser)).to.equal(false)
      await expect(communityRewards.revokeGrant(tokenId, {from: anotherUser})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })

    it("allows sender who has owner role", async () => {
      expect(await communityRewards.hasRole(OWNER_ROLE, owner)).to.equal(true)
      await expect(communityRewards.revokeGrant(tokenId, {from: owner})).to.be.fulfilled
    })

    it("rejects call for a non-existent token id", async () => {
      await expect(communityRewards.revokeGrant(tokenId.add(new BN(1)), {from: owner})).to.be.rejectedWith(
        /Grant not defined for token id/
      )
    })

    it("rejects if grant has already been revoked", async () => {
      await communityRewards.revokeGrant(tokenId, {from: owner})
      await expect(communityRewards.revokeGrant(tokenId, {from: owner})).to.be.rejectedWith(
        /Grant has already been revoked/
      )
    })

    it("rejects if grant has already fully vested", async () => {
      await ethers.provider.send("evm_mine", [])
      await advanceTime({seconds: vestingLength.div(new BN(2))})
      await expect(communityRewards.revokeGrant(tokenId, {from: owner})).to.be.rejectedWith(/Grant has fully vested/)
      const currentTimestamp = await getCurrentTimestamp()
      expect(currentTimestamp).to.bignumber.equal(grantedAt.add(vestingLength))
    })

    it("updates state and emits an event", async () => {
      const rewardsAvailableBefore = await communityRewards.rewardsAvailable()

      const receipt = await communityRewards.revokeGrant(tokenId, {from: owner})

      const expectedTotalUnvested = amount.div(new BN(2))

      // Increments rewards available.
      const rewardsAvailableAfter = await communityRewards.rewardsAvailable()
      expect(rewardsAvailableAfter.sub(rewardsAvailableBefore)).to.bignumber.equal(expectedTotalUnvested)

      // Sets revoked-at timestamp.
      const grantState = await communityRewards.grants(tokenId)
      assertCommunityRewardsVestingRewards(grantState)
      expect(grantState.revokedAt).to.bignumber.equal(grantedAt.add(vestingLength.div(new BN(2))))
      const currentTimestamp = await getCurrentTimestamp()
      expect(grantState.revokedAt).to.bignumber.equal(currentTimestamp)

      // Emits event.
      const grantRevokedEvent = getOnlyLog<GrantRevoked>(
        decodeLogs(receipt.receipt.rawLogs, communityRewards, "GrantRevoked")
      )
      expect(grantRevokedEvent.args.tokenId).to.bignumber.equal(tokenId)
      expect(grantRevokedEvent.args.totalUnvested).to.bignumber.equal(expectedTotalUnvested)
    })

    context("paused", async () => {
      it("reverts", async () => {
        const amount = new BN(1e3)
        await mintAndLoadRewards(gfi, communityRewards, owner, amount)
        const tokenId = await grant({
          recipient: anotherUser,
          amount: amount,
          vestingLength: new BN(1),
          cliffLength: new BN(0),
          vestingInterval: new BN(1),
        })
        await communityRewards.pause()
        await expect(communityRewards.revokeGrant(tokenId, {from: owner})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("getReward", async () => {
    let amount: BN
    let grantedAt: BN

    beforeEach(async () => {
      amount = new BN(1e6)
      await mintAndLoadRewards(gfi, communityRewards, owner, amount)
      grantedAt = new BN(TOKEN_LAUNCH_TIME)
    })
    it("rejects sender who is not owner of the token", async () => {
      const tokenId = await grant({
        recipient: anotherUser,
        amount,
        vestingLength: new BN(1000),
        cliffLength: new BN(0),
        vestingInterval: new BN(1),
      })
      expect(await communityRewards.ownerOf(tokenId)).to.equal(anotherUser)
      await expect(communityRewards.getReward(tokenId, {from: owner})).to.be.rejectedWith(/access denied/)
    })

    it("allows call if claimable amount is 0", async () => {
      const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
      expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

      const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
      expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

      const tokenId = await grant({
        recipient: anotherUser,
        amount,
        vestingLength: new BN(1000),
        cliffLength: new BN(500),
        vestingInterval: new BN(1),
      })
      const claimable = await communityRewards.claimableRewards(tokenId)
      expect(claimable).to.bignumber.equal(new BN(0))

      const receipt = await communityRewards.getReward(tokenId, {from: anotherUser})

      await expectStateAfterGetReward(
        gfi,
        communityRewards,
        anotherUser,
        tokenId,
        amount,
        // Does not increment total claimed.
        new BN(0),
        // Does not transfer GFI.
        new BN(0),
        contractGfiBalanceBefore
      )

      // Does not emit event.
      expectEvent.notEmitted(receipt, "RewardPaid")
    })

    it("updates state, transfers rewards, and emits an event, if claimable amount is > 0", async () => {
      const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
      expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

      const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
      expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

      const vestingLength = new BN(1000)
      const cliffLength = new BN(500)
      const tokenId = await grant({
        recipient: anotherUser,
        amount,
        vestingLength,
        cliffLength,
        vestingInterval: new BN(1),
      })

      await advanceTime({toSecond: grantedAt.add(cliffLength)})
      await ethers.provider.send("evm_mine", [])

      const expectedClaimableAtCliff = amount.mul(cliffLength).div(vestingLength)
      const claimable = await communityRewards.claimableRewards(tokenId)
      expect(claimable).to.bignumber.equal(expectedClaimableAtCliff)

      const receipt = await communityRewards.getReward(tokenId, {from: anotherUser})
      const currentTimestamp = await getCurrentTimestamp()
      expect(currentTimestamp).to.bignumber.equal(grantedAt.add(cliffLength).add(new BN(1)))

      const expectedClaimedJustAfterCliff = expectedClaimableAtCliff.add(amount.mul(new BN(1)).div(vestingLength))

      await expectStateAfterGetReward(
        gfi,
        communityRewards,
        anotherUser,
        tokenId,
        amount,
        // Increments total claimed.
        expectedClaimedJustAfterCliff,
        // Transfers GFI.
        expectedClaimedJustAfterCliff,
        contractGfiBalanceBefore.sub(expectedClaimedJustAfterCliff)
      )

      // Emits event.
      const rewardPaidEvent = getOnlyLog<RewardPaid>(
        decodeLogs(receipt.receipt.rawLogs, communityRewards, "RewardPaid")
      )
      expect(rewardPaidEvent.args.user).to.equal(anotherUser)
      expect(rewardPaidEvent.args.tokenId).to.bignumber.equal(tokenId)
      expect(rewardPaidEvent.args.reward).to.bignumber.equal(expectedClaimedJustAfterCliff)
    })

    context("grant with 0 vesting length", async () => {
      it("gets full grant amount", async () => {
        const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
        expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

        const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
        expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

        const tokenId = await grant({
          recipient: anotherUser,
          amount,
          vestingLength: new BN(0),
          cliffLength: new BN(0),
          vestingInterval: new BN(0),
        })
        const claimableBefore = await communityRewards.claimableRewards(tokenId)
        expect(claimableBefore).to.bignumber.equal(amount)

        await communityRewards.getReward(tokenId, {from: anotherUser})

        await expectStateAfterGetReward(gfi, communityRewards, anotherUser, tokenId, amount, amount, amount, new BN(0))
      })
    })

    context("grant with > 0 vesting length", async () => {
      const vestingLength = new BN(1000)

      context("0 cliff", async () => {
        const cliffLength = new BN(0)

        context("vesting interval of 1", async () => {
          const vestingInterval = new BN(1)

          it("gets the vested amount", async () => {
            const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
            expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

            const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
            expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

            const tokenId = await grant({
              recipient: anotherUser,
              amount,
              vestingLength,
              cliffLength,
              vestingInterval,
            })

            await advanceTime({toSecond: grantedAt.add(vestingLength.div(new BN(2)))})

            await communityRewards.getReward(tokenId, {from: anotherUser})

            const expectedClaimed = amount.div(new BN(2))
            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimed,
              expectedClaimed,
              contractGfiBalanceBefore.sub(expectedClaimed)
            )
          })
        })
        context("vesting interval > 1", async () => {
          const vestingInterval = new BN(200)
          const totalVestingUnits = vestingLength.div(vestingInterval)

          it("gets the vested amount", async () => {
            const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
            expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

            const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
            expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

            const tokenId = await grant({
              recipient: anotherUser,
              amount,
              vestingLength,
              cliffLength,
              vestingInterval,
            })

            const elapse = new BN(500)
            await advanceTime({seconds: elapse})

            await communityRewards.getReward(tokenId, {from: anotherUser})

            const elapsedVestingUnits = elapse.div(vestingInterval)
            expect(elapsedVestingUnits).to.bignumber.equal(new BN(2))
            const expectedClaimed = amount.mul(elapsedVestingUnits).div(totalVestingUnits)
            expect(expectedClaimed).to.bignumber.equal(new BN(0.4e6))

            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimed,
              expectedClaimed,
              contractGfiBalanceBefore.sub(expectedClaimed)
            )

            const elapse2 = new BN(100)
            await advanceTime({seconds: elapse2})

            await communityRewards.getReward(tokenId, {from: anotherUser})

            const elapsedVestingUnits2 = elapse.add(elapse2).div(vestingInterval)
            expect(elapsedVestingUnits2).to.bignumber.equal(new BN(3))
            const expectedClaimed2 = amount.mul(elapsedVestingUnits2).div(totalVestingUnits)
            expect(expectedClaimed2).to.bignumber.equal(new BN(0.6e6))

            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimed2,
              expectedClaimed2,
              contractGfiBalanceBefore.sub(expectedClaimed2)
            )
          })
        })
      })
      context("> 0 cliff", async () => {
        const cliffLength = new BN(500)

        context("vesting interval of 1", async () => {
          const vestingInterval = new BN(1)

          it("gets 0 before cliff has elapsed and vested amount once cliff has elapsed", async () => {
            const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
            expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

            const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
            expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

            const tokenId = await grant({
              recipient: anotherUser,
              amount,
              vestingLength,
              cliffLength,
              vestingInterval,
            })

            await advanceTime({toSecond: grantedAt.add(cliffLength.sub(new BN(1)))})

            await communityRewards.getReward(tokenId, {from: anotherUser})

            const expectedClaimedJustBeforeCliff = new BN(0)
            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimedJustBeforeCliff,
              expectedClaimedJustBeforeCliff,
              contractGfiBalanceBefore.sub(expectedClaimedJustBeforeCliff)
            )

            await advanceTime({seconds: new BN(1)})

            await communityRewards.getReward(tokenId, {from: anotherUser})

            const expectedClaimedAtCliff = amount.mul(cliffLength).div(vestingLength)
            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimedAtCliff,
              expectedClaimedAtCliff,
              contractGfiBalanceBefore.sub(expectedClaimedAtCliff)
            )
          })
        })
        context("vesting interval > 1", async () => {
          const vestingInterval = new BN(200)
          const totalVestingUnits = vestingLength.div(vestingInterval)

          it("gets 0 before cliff has elapsed and vested amount once cliff has elapsed", async () => {
            const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
            expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

            const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
            expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

            const tokenId = await grant({
              recipient: anotherUser,
              amount,
              vestingLength,
              cliffLength,
              vestingInterval,
            })

            await advanceTime({toSecond: grantedAt.add(cliffLength.sub(new BN(1)))})

            await communityRewards.getReward(tokenId, {from: anotherUser})

            const expectedClaimedJustBeforeCliff = new BN(0)
            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimedJustBeforeCliff,
              expectedClaimedJustBeforeCliff,
              contractGfiBalanceBefore.sub(expectedClaimedJustBeforeCliff)
            )

            await advanceTime({seconds: new BN(1)})

            const elapsedVestingUnitsAtCliff = cliffLength.div(vestingInterval)
            expect(elapsedVestingUnitsAtCliff).to.bignumber.equal(new BN(2))
            const expectedClaimedAtCliff = amount.mul(elapsedVestingUnitsAtCliff).div(totalVestingUnits)
            expect(expectedClaimedAtCliff).to.bignumber.equal(new BN(0.4e6))

            await communityRewards.getReward(tokenId, {from: anotherUser})

            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimedAtCliff,
              expectedClaimedAtCliff,
              contractGfiBalanceBefore.sub(expectedClaimedAtCliff)
            )

            await advanceTime({seconds: new BN(100)})

            await communityRewards.getReward(tokenId, {from: anotherUser})

            const elapsedVestingUnits = cliffLength.add(new BN(100)).div(vestingInterval)
            expect(elapsedVestingUnits).to.bignumber.equal(new BN(3))
            const expectedClaimed3 = amount.mul(elapsedVestingUnits).div(totalVestingUnits)
            expect(expectedClaimed3).to.bignumber.equal(new BN(0.6e6))

            await expectStateAfterGetReward(
              gfi,
              communityRewards,
              anotherUser,
              tokenId,
              amount,
              expectedClaimed3,
              expectedClaimed3,
              contractGfiBalanceBefore.sub(expectedClaimed3)
            )
          })
        })
      })
    })

    context("revoked grant", async () => {
      let tokenId: BN
      let vestingLength: BN
      let grantedAt: BN

      beforeEach(async () => {
        vestingLength = new BN(1000)
        tokenId = await grant({
          recipient: anotherUser,
          amount,
          vestingLength,
          cliffLength: new BN(0),
          vestingInterval: new BN(1),
        })
        grantedAt = new BN(TOKEN_LAUNCH_TIME)
        await advanceTime({toSecond: grantedAt.add(vestingLength.div(new BN(2)))})
      })

      it("after revocation, vested amount is still claimable", async () => {
        const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
        expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

        const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
        expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

        await communityRewards.revokeGrant(tokenId, {from: owner})
        const revocationTimestamp = await getCurrentTimestamp()
        expect(revocationTimestamp).to.bignumber.equal(grantedAt.add(vestingLength.div(new BN(2))))

        const grantState = await communityRewards.grants(tokenId)
        assertCommunityRewardsVestingRewards(grantState)
        expect(grantState.revokedAt).to.bignumber.equal(revocationTimestamp)

        const expectedClaimable = amount.div(new BN(2))
        const claimable = await communityRewards.claimableRewards(tokenId)
        expect(claimable).to.bignumber.equal(expectedClaimable)

        await communityRewards.getReward(tokenId, {from: anotherUser})

        const expectedClaimed = expectedClaimable
        await expectStateAfterGetReward(
          gfi,
          communityRewards,
          anotherUser,
          tokenId,
          amount,
          expectedClaimed,
          expectedClaimed,
          contractGfiBalanceBefore.sub(expectedClaimed)
        )
      })

      it("after revocation, no further amount vests, so no further amount is claimable", async () => {
        const contractGfiBalanceBefore = await gfi.balanceOf(communityRewards.address)
        expect(contractGfiBalanceBefore).to.bignumber.equal(amount)

        const accountGfiBalanceBefore = await gfi.balanceOf(anotherUser)
        expect(accountGfiBalanceBefore).to.bignumber.equal(new BN(0))

        await communityRewards.revokeGrant(tokenId, {from: owner})
        const revocationTimestamp = await getCurrentTimestamp()
        expect(revocationTimestamp).to.bignumber.equal(grantedAt.add(vestingLength.div(new BN(2))))

        const expectedClaimable = amount.div(new BN(2))
        const claimable = await communityRewards.claimableRewards(tokenId)
        expect(claimable).to.bignumber.equal(expectedClaimable)

        await advanceTime({seconds: new BN(200)})
        await ethers.provider.send("evm_mine", [])

        const currentTimestamp = await getCurrentTimestamp()
        expect(currentTimestamp).to.bignumber.equal(revocationTimestamp.add(new BN(200)))
        const grantState = await communityRewards.grants(tokenId)
        assertCommunityRewardsVestingRewards(grantState)
        expect(grantState.revokedAt).to.bignumber.equal(revocationTimestamp)

        const expectedClaimable2 = expectedClaimable
        const claimable2 = await communityRewards.claimableRewards(tokenId)
        expect(claimable2).to.bignumber.equal(expectedClaimable2)

        await communityRewards.getReward(tokenId, {from: anotherUser})

        const expectedClaimed = expectedClaimable
        await expectStateAfterGetReward(
          gfi,
          communityRewards,
          anotherUser,
          tokenId,
          amount,
          expectedClaimed,
          expectedClaimed,
          contractGfiBalanceBefore.sub(expectedClaimed)
        )
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        const amount = new BN(1e3)
        await mintAndLoadRewards(gfi, communityRewards, owner, amount)
        const tokenId = await grant({
          recipient: anotherUser,
          amount,
          vestingLength: new BN(1),
          cliffLength: new BN(0),
          vestingInterval: new BN(1),
        })
        await communityRewards.pause()
        await expect(communityRewards.getReward(tokenId, {from: anotherUser})).to.be.rejectedWith(/paused/)
      })
    })

    context("reentrancy", async () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })
})
