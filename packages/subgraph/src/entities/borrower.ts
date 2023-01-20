import {Address, BigInt} from "@graphprotocol/graph-ts"
import {BorrowerContract as Borrower} from "../../generated/schema"
import {getOrInitUser} from "./user"

export function getOrInitBorrower(borrowerAddress: Address, owner: Address, timestamp: BigInt): Borrower {
  let borrower = Borrower.load(borrowerAddress.toHexString())
  if (!borrower) {
    borrower = new Borrower(borrowerAddress.toHexString())
    const user = getOrInitUser(owner)
    borrower.user = user.id
    borrower.createdAt = timestamp
    borrower.save()
  }
  return borrower
}
