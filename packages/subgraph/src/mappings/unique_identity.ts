import {Address, BigInt, log} from "@graphprotocol/graph-ts"
import {TransferSingle} from "../../generated/UniqueIdentity/UniqueIdentity"
import {createTransactionFromEvent} from "../entities/helpers"
import {getOrInitUser} from "../entities/user"

export function handleTransferSingle(event: TransferSingle): void {
  const uidType = event.params.id
  const isMinting = event.params.from.equals(Address.zero())
  const isBurning = event.params.to.equals(Address.zero())

  if (isMinting) {
    const receivingUser = getOrInitUser(event.params.from)
    if (uidType.equals(BigInt.fromI32(0))) {
      receivingUser.uidType = "NON_US_INDIVIDUAL"
    } else if (uidType.equals(BigInt.fromI32(1))) {
      receivingUser.uidType = "US_ACCREDITED_INDIVIDUAL"
    } else if (uidType.equals(BigInt.fromI32(2))) {
      receivingUser.uidType = "US_NON_ACCREDITED_INDIVIDUAL"
    } else if (uidType.equals(BigInt.fromI32(3))) {
      receivingUser.uidType = "US_ENTITY"
    } else if (uidType.equals(BigInt.fromI32(4))) {
      receivingUser.uidType = "NON_US_ENTITY"
    }
    receivingUser.save()
  } else if (isBurning) {
    const sendingUser = getOrInitUser(event.params.from)
    sendingUser.uidType = null
    sendingUser.save()
  } else {
    log.error("A non-mint and non-burn transfer happened in UID.", [])
  }

  const transaction = createTransactionFromEvent(event, "UID_MINTED", event.params.to)
  transaction.user = transaction.category = "UID_MINTED"
  // UID NFTs actually don't have a unique ID; they're semi-fungible.
  transaction.receivedNftId = event.params.id.toString()
  transaction.sentNftId = event.params.id.toString()
  transaction.receivedNftType = "UID"
  transaction.save()
}
