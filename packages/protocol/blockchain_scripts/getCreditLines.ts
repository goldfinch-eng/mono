import hre from "hardhat"
const {deployments, getNamedAccounts} = hre
import {getDeployedContract} from "./deployHelpers.js"
import {displayCreditLine} from "./protocolHelpers.js"

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", protocolOwner)
  const borrower = process.env.BORROWER
  const creditLine = process.env.CREDIT_LINE
  if (!borrower && !creditLine) {
    throw new Error(
      "No borrower and no credit line provided. Please run again, passing one of them in as BORROWER={{borrower_address}}"
    )
  }
  let creditLines
  if (borrower) {
    creditLines = await creditDesk.getBorrowerCreditLines(borrower)
  } else {
    creditLines = [creditLine]
  }
  console.log("The credit lines are...", creditLines)
  await Promise.all(
    creditLines.map(async (element) => {
      return displayCreditLine(element)
    })
  )
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
