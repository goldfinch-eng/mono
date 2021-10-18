/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
import {asNonNullable} from "@goldfinch-eng/utils"
import {ERC20Instance, GFIInstance, GoldfinchConfigInstance, PoolRewardsInstance} from "../typechain/truffle"
import {deployAllContracts, expect} from "./testHelpers"

const {deployments} = hre

describe("PoolRewards", () => {
  let owner: string,
    investor: string,
    anotherUser: string,
    goldfinchConfig: GoldfinchConfigInstance,
    gfi: GFIInstance,
    usdc: ERC20Instance,
    poolRewards: PoolRewardsInstance

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const [_owner, _investor, _anotherUser] = await web3.eth.getAccounts()
    const owner = asNonNullable(_owner)
    const investor = asNonNullable(_investor)
    const anotherUser = asNonNullable(_anotherUser)
    const {goldfinchConfig, gfi, poolRewards, usdc} = await deployAllContracts(deployments)
    await goldfinchConfig.bulkAddToGoList([owner, investor, anotherUser])

    const gfiAmount = new BN(1e3)
    await gfi.mint(owner, gfiAmount)
    await gfi.approve(owner, gfiAmount)
    console.log("totalSupply", await gfi.totalSupply())

    return {
      owner,
      investor,
      anotherUser,
      goldfinchConfig,
      gfi,
      poolRewards,
      usdc,
    }
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, investor, anotherUser, goldfinchConfig, gfi, poolRewards, usdc} = await testSetup())
  })

  describe("setTotalRewards", () => {
    let totalRewards: BN

    it("properly sets totalRewards, sqrtTotalRewards, and totalRewardPercentOfTotalGFI", async () => {
      totalRewards = new BN(1e3)
      await poolRewards.setTotalRewards(totalRewards)
      expect(await poolRewards.totalRewards()).to.bignumber.equal(totalRewards)
      // expect(await poolRewards.sqrtTotalRewards()).to.bignumber.equal(Math.sqrt())
      // expect(await poolRewards.totalRewardPercentOfTotalGFI()).to.bignumber.equal(totalRewards)
    })
  })
  describe("setMaxInterestDollarsEligible", () => {
    let maxInterestDollarsEligible: BN

    it("properly sets maxInterestDollarsEligible", async () => {
      maxInterestDollarsEligible = new BN(1e3)
      await poolRewards.setMaxInterestDollarsEligible(maxInterestDollarsEligible)
      expect(await poolRewards.maxInterestDollarsEligible()).to.bignumber.equal(maxInterestDollarsEligible)
    })
  })
  // describe("allocateRewards", () => {
  //   context("Invalid pool address", () => {})
  //   context("Rewards exhausted", () => {})
  // })
  // describe("poolTokenClaimableRewards", () => {})
  // describe("withdraw", () => {
  //   context("Pool is paused", () => {})
  //   context("Invalid token id", () => {})
  //   context("Overdraw", () => {})
  // })
})
