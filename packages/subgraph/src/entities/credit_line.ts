import { Address, BigInt } from '@graphprotocol/graph-ts'
import { CreditLine } from "../../generated/schema"
import { CreditLine as CreditLineContract } from '../../generated/templates/GoldfinchFactory/CreditLine'

const INTEREST_DECIMALS = 18

export function getOrInitCreditLine(address: Address): CreditLine {
  let creditLine = CreditLine.load(address.toHexString())
  if (!creditLine) {
    creditLine = initOrUpdateCreditLine(address)
  }
  return creditLine
}

export function initOrUpdateCreditLine(address: Address): CreditLine {
  let creditLine = CreditLine.load(address.toHexString())
  if (!creditLine) {
    creditLine = new CreditLine(address.toHexString())
  }
  let contract = CreditLineContract.bind(address)

  creditLine.balance = contract.balance()
  creditLine.interestApr = contract.interestApr()
  creditLine.interestAccruedAsOf = contract.interestAccruedAsOf()
  creditLine.paymentPeriodInDays = contract.paymentPeriodInDays()
  creditLine.termInDays = contract.termInDays()
  creditLine.nextDueTime = contract.nextDueTime()
  creditLine.limit = contract.limit()
  creditLine.interestOwed = contract.interestOwed()
  creditLine.termEndTime = contract.termEndTime()
  creditLine.lastFullPaymentTime = contract.lastFullPaymentTime()
  creditLine.interestAprDecimal = creditLine.interestApr.div(BigInt.fromString(INTEREST_DECIMALS.toString()))

  creditLine.save()
  return creditLine
}
