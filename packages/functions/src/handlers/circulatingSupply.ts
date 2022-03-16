import {ethers} from "ethers"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {BigNumber} from "bignumber.js"
import {genRequestHandler, getBlockchain} from "../helpers"

import type {GFI} from "@goldfinch-eng/protocol/typechain/ethers/GFI"
import GFI_DEPLOYMENT from "@goldfinch-eng/protocol/deployments/mainnet/GFI.json"
import STAKING_REWARDS_DEPLOYMENT from "@goldfinch-eng/protocol/deployments/mainnet/StakingRewards.json"
import COMMUNITY_REWARDS_DEPLOYMENT from "@goldfinch-eng/protocol/deployments/mainnet/CommunityRewards.json"

/**
 * Calculate liquid GFI according to a predetermined unlock schedule.
 * Unlocked GFI should be considered as part of circulating supply.
 *
 * The unlock schedule is as follows:
 *  - At `firstUnlockTimeInSeconds`, 1/6 of `startingBalance` is unlocked
 *  - For every month thereafter, an additional 1/36 of `startingBalance` is unlocked
 *    to a max of `startingBalance`
 *
 * @return {BigNumber} Amount of unlocked GFI in GFI units
 */
export const calculateUnlockedCustodyGFI = function ({
  startingBalance,
  currentTimeInSeconds,
  firstUnlockTimeInSeconds,
}: {
  startingBalance: BigNumber
  currentTimeInSeconds: number
  firstUnlockTimeInSeconds: number
}): BigNumber {
  const elapsedTimeInSeconds = currentTimeInSeconds - firstUnlockTimeInSeconds
  const oneMonthInSeconds = 60 * 60 * 24 * 30

  let supplyToInclude = new BigNumber(0)
  const elapsedMonths = Math.floor(elapsedTimeInSeconds / oneMonthInSeconds)
  if (elapsedMonths >= 0) {
    // 1/6 unlocks in first month
    supplyToInclude = startingBalance.dividedBy(6)
    // 1/36 unlocked every month thereafter
    supplyToInclude = BigNumber.min(
      startingBalance,
      supplyToInclude.plus(startingBalance.dividedBy(36).times(elapsedMonths)),
    )
  }

  return supplyToInclude
}

/**
 * Calculates circulating supply of GFI. The response is given in GFI rather than atomic units.
 */
export const circulatingSupply = genRequestHandler({
  requireAuth: false,
  cors: false,
  handler: async (_, res): Promise<Response> => {
    const provider = getBlockchain("https://app.goldfinch.finance")
    const gfi = new ethers.Contract(GFI_DEPLOYMENT.address, GFI_DEPLOYMENT.abi, provider) as GFI

    const totalSupply = new BigNumber((await gfi.totalSupply()).toString()).dividedBy(1e18)
    const cbCustodyBalance = new BigNumber(55_122_810)

    // Start with the total supply
    let circulatingSupply = totalSupply

    const treasuryAddress = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"
    const stakingRewardsAddress = STAKING_REWARDS_DEPLOYMENT.address
    const communityRewardsAddress = COMMUNITY_REWARDS_DEPLOYMENT.address

    // Exclude illiquid contract balances. Note that ideally, we'd only exclude locked GFI
    // from StakingRewards and CommunityRewards, but there isn't an easy way to do this, short
    // of enumerating vesting position IDs.
    const balancesToExclude = await Promise.all(
      [treasuryAddress, stakingRewardsAddress, communityRewardsAddress].map(async (addr) =>
        new BigNumber((await gfi.balanceOf(addr)).toString()).dividedBy(1e18),
      ),
    )
    circulatingSupply = circulatingSupply.minus(BigNumber.sum(...balancesToExclude))

    // Exclude illiquid GFI in Coinbase Custody according to the unlock schedule
    circulatingSupply = circulatingSupply.minus(cbCustodyBalance)
    const supplyToInclude = calculateUnlockedCustodyGFI({
      startingBalance: cbCustodyBalance,
      currentTimeInSeconds: Date.now() / 1000,
      firstUnlockTimeInSeconds: new Date("2022-07-11").getTime() / 1000,
    })
    circulatingSupply = circulatingSupply.plus(supplyToInclude)

    return res.status(200).send(circulatingSupply.toString())
  },
})
