/* globals ethers */
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {getDeployedContract, getUSDCAddress, assertIsChainId} = require("../blockchain_scripts/deployHelpers.js")
const {assertIsString} = require("../utils/type.js")
const {getChainId} = hre

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", protocolOwner)
  const chainId = await getChainId()
  assertIsChainId(chainId)
  const usdcAddress = getUSDCAddress(chainId)
  assertIsString(usdcAddress)
  const usdc = await ethers.getContractAt("Fidu", usdcAddress)
  const creditLine = process.env.CREDIT_LINE
  if (!creditLine) {
    throw new Error("No creditLine provided. Please run again, passing creditLine as BORROWER={{creditLine_address}}")
  }

  await assessCreditLine(creditDesk, creditLine, usdc)
}

async function assessCreditLine(creditDesk, creditLineAddress, usdc, logger = console.log) {
  logger("Attempting to assess the credit line...")
  const creditLine = await ethers.getContractAt("CreditLine", creditLineAddress)

  let balance = await creditLine.balance()
  let interestOwed = await creditLine.interestOwed()
  let principalOwed = await creditLine.principalOwed()
  let USDCBalance = await usdc.balanceOf(creditLineAddress)
  let termEndTime = await creditLine.termEndTime()
  let nextDueTime = await creditLine.nextDueTime()
  let interestAccruedAsOf = await creditLine.interestAccruedAsOf()

  logger("Credit line vars before assessment:")
  logger("balance:", String(balance))
  logger("interestOwed:", String(interestOwed))
  logger("principalOwed:", String(principalOwed))
  logger("USDC Balance:", String(USDCBalance))
  logger("termEndTime:", String(termEndTime))
  logger("nextDueTime:", String(nextDueTime))
  logger("interestAccruedAsOf:", String(interestAccruedAsOf))

  logger("Assessing the credit line...")
  await (await creditDesk.assessCreditLine(creditLineAddress)).wait()
  logger("Credit line has been assessed")

  balance = await creditLine.balance()
  interestOwed = await creditLine.interestOwed()
  principalOwed = await creditLine.principalOwed()
  USDCBalance = await usdc.balanceOf(creditLineAddress)
  termEndTime = await creditLine.termEndTime()
  nextDueTime = await creditLine.nextDueTime()
  interestAccruedAsOf = await creditLine.interestAccruedAsOf()

  logger("After assessment:")
  logger("balance:", String(balance))
  logger("interestOwed:", String(interestOwed))
  logger("principalOwed:", String(principalOwed))
  logger("USDC Balance:", String(USDCBalance))
  logger("termEndTime:", String(termEndTime))
  logger("nextDueTime:", String(nextDueTime))
  logger("interestAccruedAsOf:", String(interestAccruedAsOf))
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

module.exports = assessCreditLine
