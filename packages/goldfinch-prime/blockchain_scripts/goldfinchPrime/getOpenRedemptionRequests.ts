import {EventFilter} from "ethers"
import hre from "hardhat"

import {getDeployedContract} from "../deployHelpers"

interface RedemptionRequest {
  totalSharesRequested: string
  sharesRedeemed: string
  remainingShares: string
  usdcToReceive: string
  totalUsdcFulfilled: string
  user: string
  requestedAt: string
  usdcNeededForRemaining: string
}

async function main() {
  const {deployments} = hre

  console.log("Fetching open redemption requests...")

  // Get GPrime contract
  const gPrime = await getDeployedContract(deployments, "GoldfinchPrime")

  // Get all RedemptionRequested events
  const filter = (gPrime.filters.RedemptionRequested as Function)()
  const events = await gPrime.queryFilter(filter as EventFilter)

  // Process events to get current open requests
  const openRequests: RedemptionRequest[] = []

  for (const event of events) {
    if (!event.args) continue
    const {user, timestamp} = event.args

    // Get current state of the redemption request
    const request = await gPrime.redemptionRequests(user)

    // Check if this request still has shares left to redeem
    if (!request.totalSharesRequested || !request.sharesRedeemed) continue
    const remainingShares = request.totalSharesRequested.sub(request.sharesRedeemed)
    if (remainingShares.gt(0)) {
      // Use contract's getShareValue function to calculate USDC needed
      const usdcNeeded = await gPrime.getShareValue(remainingShares)

      openRequests.push({
        user,
        totalSharesRequested: request.totalSharesRequested.toString(),
        sharesRedeemed: request.sharesRedeemed.toString(),
        remainingShares: remainingShares.toString(),
        usdcToReceive: request.usdcToReceive.toString(),
        totalUsdcFulfilled: request.totalUsdcFulfilled.toString(),
        requestedAt: new Date(timestamp.toNumber() * 1000).toISOString(),
        usdcNeededForRemaining: usdcNeeded.toString(),
      })
    }
  }

  console.log("\nOpen Redemption Requests:")
  console.log("------------------------")

  if (openRequests.length === 0) {
    console.log("No open redemption requests found")
  } else {
    openRequests.forEach((request) => {
      console.log(`\nUser: ${request.user}`)
      console.log(`Total Shares Requested: ${request.totalSharesRequested}`)
      console.log(`Shares Already Redeemed: ${request.sharesRedeemed}`)
      console.log(`Remaining Shares: ${request.remainingShares}`)
      console.log(`USDC Available to Receive: ${request.usdcToReceive}`)
      console.log(`Total USDC Fulfilled: ${request.totalUsdcFulfilled}`)
      console.log(`USDC Needed for Remaining Shares: ${request.usdcNeededForRemaining}`)
      console.log(`Requested At: ${request.requestedAt}`)
    })
  }
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default main
