/* globals ethers */
const {getChainId} = require("hardhat")
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const _ = require("lodash")
const {getDeployedContract, getUSDCAddress} = require("../blockchain_scripts/deployHelpers.js")

async function displayCreditLine(creditLineAddress) {
  const creditLine = await ethers.getContractAt("CreditLine", creditLineAddress)
  const usdc = await ethers.getContractAt("Fidu", getUSDCAddress(await getChainId()))

  const [
    borrower,
    limit,
    balance,
    interestOwed,
    principalOwed,
    USDCBalance,
    termEndTime,
    nextDueTime,
    interestAccruedAsOf,
    writedownAmount,
    interestApr,
  ] = await Promise.all([
    creditLine.borrower(),
    creditLine.limit(),
    creditLine.balance(),
    creditLine.interestOwed(),
    creditLine.principalOwed(),
    usdc.balanceOf(creditLineAddress),
    creditLine.termEndTime(),
    creditLine.nextDueTime(),
    creditLine.interestAccruedAsOf(),
    creditLine.writedownAmount(),
    creditLine.interestApr(),
  ])

  console.log(`--------- Credit line ${creditLineAddress} ----------`)
  console.log("Borrower:", String(borrower))
  console.log("limit:", String(limit))
  console.log("balance:", String(balance))
  console.log("interestOwed:", String(interestOwed))
  console.log("principalOwed:", String(principalOwed))
  console.log("USDCBalance:", String(USDCBalance))
  console.log("termEndTime:", String(termEndTime))
  console.log("nextDueTime:", String(nextDueTime))
  console.log("interestAccruedAsOf:", String(interestAccruedAsOf))
  console.log("writedownAmount:", String(writedownAmount))
  console.log("interestApr:", String(interestApr))
}

async function getCreditLine(creditLineAddress) {
  return await ethers.getContractAt("CreditLine", creditLineAddress)
}

async function migrateCreditLine(creditLineAddress, creditLineOpts) {
  if (!creditLineAddress) {
    throw new Error("You did not pass term in days or credit line address!")
  }
  const {protocolOwner} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", protocolOwner)
  const creditLine = await getCreditLine(creditLineAddress)
  if ((await creditLine.balance()).eq("0")) {
    throw new Error("Credit line has a zero balance so is not migrateable!")
  }
  console.log("Migrating the credit line...")
  const txn = await creditDesk.migrateCreditLine(
    creditLineAddress,
    creditLineOpts.borrower || String(await creditLine.borrower()),
    creditLineOpts.limit || String(await creditLine.limit()),
    creditLineOpts.interestApr || String(await creditLine.interestApr()),
    creditLineOpts.paymentPeriodInDays || String(await creditLine.paymentPeriodInDays()),
    creditLineOpts.termInDays || String(await creditLine.termInDays()),
    creditLineOpts.lateFeeApr || String(await creditLine.lateFeeApr())
  )
  const result = await txn.wait()
  let createdEvent = _.find(result.events, (event) => event.event === "CreditLineCreated")
  let newCreditLineAddress = createdEvent.args.creditLine
  await displayCreditLine(newCreditLineAddress)
}

module.exports = {
  displayCreditLine: displayCreditLine,
  migrateCreditLine: migrateCreditLine,
  getCreditLine: getCreditLine,
}
