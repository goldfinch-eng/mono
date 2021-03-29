/* globals */
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function main() {
  const borrower = process.env.BORROWER
  const {proxy_owner} = await getNamedAccounts()

  if (!borrower) {
    throw new Error("You must supply an existing borrower when creating a borrower contract")
  }

  let creditLineFactory = await getDeployedContract(deployments, "CreditLineFactory", proxy_owner)
  console.log(
    "Creating the borrower contract from CreditLine Factory:",
    creditLineFactory.address,
    "for",
    borrower,
    "using proxy owner account of:",
    proxy_owner
  )
  const result = await (await creditLineFactory.createBorrower(borrower)).wait()
  let bwrConAddr = result.events[result.events.length - 1].args[0]
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

module.exports = main
