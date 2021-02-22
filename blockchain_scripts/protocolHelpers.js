/* globals ethers */
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const _ = require("lodash")
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function displayCreditLine(creditLineAddress) {
  const {protocolOwner} = await getNamedAccounts()
  const creditLine = await ethers.getContractAt("CreditLine", creditLineAddress)
  const usdc = await getDeployedContract(deployments, "TestERC20", protocolOwner)

  const [
    limit,
    balance,
    interestOwed,
    principalOwed,
    USDCBalance,
    termEndBlock,
    nextDueBlock,
    interestAccruedAsOfBlock,
    writedownAmount,
    interestApr,
  ] = await Promise.all([
    creditLine.limit(),
    creditLine.balance(),
    creditLine.interestOwed(),
    creditLine.principalOwed(),
    usdc.balanceOf(creditLineAddress),
    creditLine.termEndBlock(),
    creditLine.nextDueBlock(),
    creditLine.interestAccruedAsOfBlock(),
    creditLine.writedownAmount(),
    creditLine.interestApr(),
  ])

  console.log(`--------- Credit line ${creditLineAddress} ----------`)
  console.log("limit:", String(limit))
  console.log("balance:", String(balance))
  console.log("interestOwed:", String(interestOwed))
  console.log("principalOwed:", String(principalOwed))
  console.log("USDCBalance:", String(USDCBalance))
  console.log("termEndBlock:", String(termEndBlock))
  console.log("nextDueBlock:", String(nextDueBlock))
  console.log("interestAccruedAsOfBlock:", String(interestAccruedAsOfBlock))
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
