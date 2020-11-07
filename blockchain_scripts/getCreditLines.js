const bre = require("@nomiclabs/buidler")
const {deployments, getNamedAccounts} = bre
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", protocolOwner)
  const borrower = process.env.BORROWER
  if (!borrower) {
    throw new Error("No borrower provided. Please run again, passing borrower as BORROWER={{borrower_address}}")
  }

  console.log("The credit lines are...", await creditDesk.getBorrowerCreditLines(borrower))
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
