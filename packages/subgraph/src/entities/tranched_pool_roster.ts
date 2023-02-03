import {Address, BigInt} from "@graphprotocol/graph-ts"
import {TranchedPoolRoster} from "../../generated/schema"

function getOrInitTranchedPoolRoster(): TranchedPoolRoster {
  let tranchedPoolRoster = TranchedPoolRoster.load("1")
  if (!tranchedPoolRoster) {
    tranchedPoolRoster = new TranchedPoolRoster("1")
    tranchedPoolRoster.tranchedPools = []
    tranchedPoolRoster.totalWritedowns = BigInt.zero()
    tranchedPoolRoster.totalDrawdowns = BigInt.zero()
    tranchedPoolRoster.totalPrincipalCollected = BigInt.zero()
    tranchedPoolRoster.totalInterestCollected = BigInt.zero()
    tranchedPoolRoster.totalReserveCollected = BigInt.zero()
  }
  return tranchedPoolRoster
}

export function getListOfAllTranchedPoolAddresses(): string[] {
  return getOrInitTranchedPoolRoster().tranchedPools
}

export function addToListOfAllTranchedPools(tranchedPoolAddress: Address): void {
  const tranchedPoolRoster = getOrInitTranchedPoolRoster()
  tranchedPoolRoster.tranchedPools = tranchedPoolRoster.tranchedPools.concat([tranchedPoolAddress.toHexString()])
  tranchedPoolRoster.save()
}

export function updateTotalWriteDowns(amount: BigInt): void {
  const tranchedPoolRoster = getOrInitTranchedPoolRoster()
  tranchedPoolRoster.totalWritedowns = tranchedPoolRoster.totalWritedowns.plus(amount)
  tranchedPoolRoster.save()
}

export function updateTotalDrawdowns(amount: BigInt): void {
  const tranchedPoolRoster = getOrInitTranchedPoolRoster()
  tranchedPoolRoster.totalDrawdowns = tranchedPoolRoster.totalDrawdowns.plus(amount)
  tranchedPoolRoster.save()
}

export function updateTotalPrincipalCollected(amount: BigInt): void {
  const tranchedPoolRoster = getOrInitTranchedPoolRoster()
  tranchedPoolRoster.totalPrincipalCollected = tranchedPoolRoster.totalPrincipalCollected.plus(amount)
  tranchedPoolRoster.save()
}

export function updateTotalInterestCollected(amount: BigInt): void {
  const tranchedPoolRoster = getOrInitTranchedPoolRoster()
  tranchedPoolRoster.totalInterestCollected = tranchedPoolRoster.totalInterestCollected.plus(amount)
  tranchedPoolRoster.save()
}

export function updateTotalReserveCollected(amount: BigInt): void {
  const tranchedPoolRoster = getOrInitTranchedPoolRoster()
  tranchedPoolRoster.totalReserveCollected = tranchedPoolRoster.totalReserveCollected.plus(amount)
  tranchedPoolRoster.save()
}
