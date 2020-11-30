/* globals ethers */
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function displayCreditLine(creditLineAddress) {
  const {protocolOwner} = await getNamedAccounts()
  const creditLine = await ethers.getContractAt("CreditLine", creditLineAddress)
  const usdc = await getDeployedContract(deployments, "TestERC20", protocolOwner)

  const [
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

  console.log("--------- Credit line vars: ----------")
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

module.exports = {
  displayCreditLine: displayCreditLine,
}
