import hre from "hardhat"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
const {deployments, getNamedAccounts} = hre
import {getDeployedContract} from "../blockchain_scripts/deployHelpers.js"
import {GoldfinchFactory} from "../typechain/ethers/GoldfinchFactory.js"

async function main() {
  const borrower = process.env.BORROWER
  const {gf_deployer} = await getNamedAccounts()

  if (!borrower) {
    throw new Error("You must supply an existing borrower when creating a borrower contract")
  }

  const goldfinchFactory = await getDeployedContract<GoldfinchFactory>(deployments, "GoldfinchFactory", gf_deployer)
  console.log(
    "Creating the borrower contract from CreditLine Factory:",
    goldfinchFactory.address,
    "for",
    borrower,
    "using proxy owner account of:",
    gf_deployer
  )
  const result = await (await goldfinchFactory.createBorrower(borrower)).wait()
  assertNonNullable(result.events)
  const event = asNonNullable(result.events[result.events.length - 1])
  const bwrConAddr = asNonNullable(event.args)[0]
  console.log("Created borrower contract at:", bwrConAddr)
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
