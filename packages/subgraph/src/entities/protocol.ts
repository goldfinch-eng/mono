import {Address, BigDecimal, BigInt} from "@graphprotocol/graph-ts"
import {Protocol} from "../../generated/schema"

function getOrInitProtocol(): Protocol {
  let protocol = Protocol.load("1")
  if (!protocol) {
    protocol = new Protocol("1")
    protocol.loans = []
    protocol.totalWritedowns = BigInt.zero()
    protocol.totalDrawdowns = BigInt.zero()
    protocol.defaultRate = BigDecimal.zero()
    protocol.totalPrincipalCollected = BigInt.zero()
    protocol.totalInterestCollected = BigInt.zero()
    protocol.totalReserveCollected = BigInt.zero()
  }
  return protocol
}

export function getListOfAllTranchedPoolAddresses(): string[] {
  return getOrInitProtocol().loans
}

export function addToListOfAllLoans(loanAddress: Address): void {
  const protocol = getOrInitProtocol()
  protocol.loans = protocol.loans.concat([loanAddress.toHexString()])
  protocol.save()
}

export function updateTotalWriteDowns(amount: BigInt): void {
  const protocol = getOrInitProtocol()
  protocol.totalWritedowns = protocol.totalWritedowns.plus(amount)
  protocol.defaultRate =
    protocol.totalDrawdowns.isZero() || protocol.totalWritedowns.isZero()
      ? BigDecimal.zero()
      : protocol.totalWritedowns.divDecimal(protocol.totalDrawdowns.toBigDecimal())
  protocol.save()
}

export function updateTotalDrawdowns(amount: BigInt): void {
  const protocol = getOrInitProtocol()
  protocol.totalDrawdowns = protocol.totalDrawdowns.plus(amount)
  protocol.defaultRate =
    protocol.totalDrawdowns.isZero() || protocol.totalWritedowns.isZero()
      ? BigDecimal.zero()
      : protocol.totalWritedowns.divDecimal(protocol.totalDrawdowns.toBigDecimal())
  protocol.save()
}

export function updateTotalPrincipalCollected(amount: BigInt): void {
  const protocol = getOrInitProtocol()
  protocol.totalPrincipalCollected = protocol.totalPrincipalCollected.plus(amount)
  protocol.save()
}

export function updateTotalInterestCollected(amount: BigInt): void {
  const protocol = getOrInitProtocol()
  protocol.totalInterestCollected = protocol.totalInterestCollected.plus(amount)
  protocol.save()
}

export function updateTotalReserveCollected(amount: BigInt): void {
  const protocol = getOrInitProtocol()
  protocol.totalReserveCollected = protocol.totalReserveCollected.plus(amount)
  protocol.save()
}
