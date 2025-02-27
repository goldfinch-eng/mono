import hre from "hardhat"

import {getDeployedContract} from "../deployHelpers"

async function main() {
  const {deployments} = hre

  console.log("Fetching available drawdown amount...")

  // Get GPrime contract
  const gPrime = await getDeployedContract(deployments, "GoldfinchPrime")

  // Get available drawdown amount
  const availableToDrawdown = await gPrime.availableToDrawdown()

  console.log("\nAvailable to Drawdown:")
  console.log("------------------------")
  console.log(`Amount (in atomic USDC units): ${availableToDrawdown.toString()}`)
  console.log(`Amount (in USDC): ${(Number(availableToDrawdown.toString()) / 1e6).toFixed(2)}`)
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
