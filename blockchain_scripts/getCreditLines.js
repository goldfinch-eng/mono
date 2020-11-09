/* globals ethers */
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", protocolOwner)
  const usdc = await getDeployedContract(deployments, "TestERC20", protocolOwner)
  const logger = console.log
  const borrower = process.env.BORROWER
  if (!borrower) {
    throw new Error("No borrower provided. Please run again, passing borrower as BORROWER={{borrower_address}}")
  }
  const creditLines = await creditDesk.getBorrowerCreditLines(borrower)
  console.log("The credit lines are...", creditLines)
  const creditLine = await ethers.getContractAt("CreditLine", creditLines[0])

  let balance = await creditLine.balance()
  let interestOwed = await creditLine.interestOwed()
  let principalOwed = await creditLine.principalOwed()
  let USDCBalance = await usdc.balanceOf(creditLines[0])
  let termEndBlock = await creditLine.termEndBlock()
  let nextDueBlock = await creditLine.nextDueBlock()
  let lastUpdatedBlock = await creditLine.lastUpdatedBlock()
  let writedownAmount = await creditLine.writedownAmount()

  logger("Credit line vars:")
  logger("balance:", String(balance))
  logger("interestOwed:", String(interestOwed))
  logger("principalOwed:", String(principalOwed))
  logger("USDCBalance:", String(USDCBalance))
  logger("termEndBlock:", String(termEndBlock))
  logger("nextDueBlock:", String(nextDueBlock))
  logger("lastUpdatedBlock:", String(lastUpdatedBlock))
  logger("writedownAmount:", String(writedownAmount))
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
