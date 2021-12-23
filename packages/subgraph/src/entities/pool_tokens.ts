import { Address, BigInt } from '@graphprotocol/graph-ts'
import { TranchedPoolToken } from "../../generated/schema"
import { PoolTokens as PoolTokensContract } from '../../generated/templates/PoolTokens/PoolTokens'
import { TranchedPool as TranchedPoolContract } from '../../generated/templates/PoolTokens/TranchedPool'
import { POOL_TOKENS_ADDRESS } from '../constants'
import { getOrInitUser } from './user'

export function getOrInitTranchedPoolToken(tokenId: BigInt, owner: Address): TranchedPoolToken {
  const id = tokenId.toString()
  let poolToken = TranchedPoolToken.load(id)
  if (!poolToken) {
    const contract = PoolTokensContract.bind(Address.fromString(POOL_TOKENS_ADDRESS))
    const result = contract.getTokenInfo(tokenId)

    poolToken = new TranchedPoolToken(id)
    poolToken.user = owner.toHexString()
    poolToken.tranchedPool = result.pool.toHexString()
    poolToken.tranche = result.tranche
    poolToken.principalAmount = result.principalAmount
    poolToken.principalRedeemed = result.principalRedeemed
    poolToken.interestRedeemed = result.interestRedeemed
    poolToken.interestRedeemable = new BigInt(0)
    poolToken.principalRedeemable = new BigInt(0)
    poolToken.save()
  }
  return poolToken
}

export function updateTranchedPoolToken(tokenId: BigInt): void {
  const id = tokenId.toString()

  const contract = PoolTokensContract.bind(Address.fromString(POOL_TOKENS_ADDRESS))
  const result = contract.getTokenInfo(tokenId)

  let poolToken = TranchedPoolToken.load(id)
  if (!poolToken) {
    return
  }

  const ownerAddress = contract.ownerOf(tokenId)
  poolToken.user = ownerAddress.toHexString()
  poolToken.tranchedPool = result.pool.toHexString()
  poolToken.tranche = result.tranche
  poolToken.principalAmount = result.principalAmount
  poolToken.principalRedeemed = result.principalRedeemed
  poolToken.interestRedeemed = result.interestRedeemed

  const poolContract = TranchedPoolContract.bind(result.pool)
  const availableToWithdraw = poolContract.availableToWithdraw(tokenId)
  poolToken.interestRedeemable = availableToWithdraw.value0
  poolToken.principalRedeemable = availableToWithdraw.value1
  poolToken.save()
}


export function handleTranchedPoolTokenTransfer(to: Address, tokenId: BigInt): void {
  let poolToken = TranchedPoolToken.load(tokenId.toString())
  if (!poolToken) {
    return
  }
  getOrInitUser(to)
  updateTranchedPoolToken(tokenId)
}


