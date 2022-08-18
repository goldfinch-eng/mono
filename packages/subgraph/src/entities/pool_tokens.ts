import {Address, BigInt} from "@graphprotocol/graph-ts"
import {Transfer} from "../../generated/PoolTokens/PoolTokens"
import {TranchedPool, TranchedPoolToken} from "../../generated/schema"
import {PoolTokens as PoolTokensContract} from "../../generated/PoolTokens/PoolTokens"
import {POOL_TOKENS_ADDRESS} from "../constants"
import {updatePoolBacker} from "./pool_backer"
import {getOrInitUser} from "./user"
import {deleteZapAfterClaimMaybe} from "./zapper"

export function initOrUpdateTranchedPoolToken(tokenId: BigInt): TranchedPoolToken {
  const id = tokenId.toString()
  let poolToken = TranchedPoolToken.load(id)
  let isCreating = !poolToken
  if (!poolToken) {
    poolToken = new TranchedPoolToken(id)
  }

  const contract = PoolTokensContract.bind(Address.fromString(POOL_TOKENS_ADDRESS))
  const result = contract.getTokenInfo(BigInt.fromString(id))
  const ownerAddress = contract.ownerOf(BigInt.fromString(id))

  poolToken.user = ownerAddress.toHexString()
  poolToken.tranchedPool = result.pool.toHexString()
  poolToken.tranche = result.tranche
  poolToken.principalAmount = result.principalAmount
  poolToken.principalRedeemed = result.principalRedeemed
  poolToken.interestRedeemed = result.interestRedeemed
  poolToken.interestRedeemable = new BigInt(0)
  poolToken.principalRedeemable = new BigInt(0)

  if (isCreating) {
    let tranchedPool = TranchedPool.load(poolToken.tranchedPool)
    if (tranchedPool) {
      let tokenIdList = tranchedPool.tokens
      tokenIdList.push(id)
      tranchedPool.tokens = tokenIdList
      tranchedPool.save()
    } else {
      // There's one scenario where the Transfer event happens before the PoolCreated. This check is required
      // because handleTransfer triggers updates on the involved backers
    }
  }

  poolToken.save()

  return poolToken
}

export function handleTranchedPoolTokenTransfer(event: Transfer): void {
  getOrInitUser(event.params.to)
  getOrInitUser(event.params.from)

  let poolToken = initOrUpdateTranchedPoolToken(event.params.tokenId)
  updatePoolBacker(event.params.to, Address.fromString(poolToken.tranchedPool))
  updatePoolBacker(event.params.from, Address.fromString(poolToken.tranchedPool))

  deleteZapAfterClaimMaybe(event)
}
