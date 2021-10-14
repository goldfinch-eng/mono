import {getChainId} from "hardhat"
import hre from "hardhat"
const {ethers} = hre
import _ from "lodash"
import {getUSDCAddress, assertIsChainId} from "../blockchain_scripts/deployHelpers"
import {assertIsString} from "@goldfinch-eng/utils"

async function displayCreditLine(creditLineAddress) {
  const creditLine = await ethers.getContractAt("CreditLine", creditLineAddress)
  const chainId = await getChainId()
  assertIsChainId(chainId)
  const usdcAddress = getUSDCAddress(chainId)
  assertIsString(usdcAddress)
  const usdc = await ethers.getContractAt("Fidu", usdcAddress)

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
  console.log("interestApr:", String(interestApr))
}

async function getCreditLine(creditLineAddress) {
  return await ethers.getContractAt("CreditLine", creditLineAddress)
}

export {displayCreditLine, getCreditLine}
