import { Address, BigInt } from '@graphprotocol/graph-ts'
import { PoolBacker, TranchedPoolToken } from "../../generated/schema"
import { TranchedPool as TranchedPoolContract } from '../../generated/templates/PoolTokens/TranchedPool'
import { getOrInitUser } from './user'

// Currently, AssemblyScript does not support Closures.
// Because of that, we need to do some restructuring on the code
// so closures are not necessary.
// https://www.assemblyscript.org/status.html#closures
export function getOrInitPoolBacker(poolAddress: Address, userAddress: Address): PoolBacker {
  const id = `${poolAddress.toHexString()}-${userAddress.toHexString()}`
  let poolBacker = PoolBacker.load(id)
  if (!poolBacker) {
    poolBacker = new PoolBacker(id)
    poolBacker.user = userAddress.toHexString()
    poolBacker.tranchedPool = poolAddress.toHexString()
    poolBacker.principalAmount = new BigInt(0)
    poolBacker.principalRedeemed = new BigInt(0)
    poolBacker.interestRedeemed = new BigInt(0)
    poolBacker.principalAtRisk = new BigInt(0)
    poolBacker.balance = new BigInt(0)
    poolBacker.availableToWithdraw = new BigInt(0)
    poolBacker.unrealizedGains = new BigInt(0)
    poolBacker.principalRedeemable = new BigInt(0)
    poolBacker.interestRedeemable = new BigInt(0)
    poolBacker.save()
  }
  return poolBacker
}

export function updatePoolBacker(userAddress: Address, tokenId: BigInt): void {
  const tranchedPoolToken = TranchedPoolToken.load(tokenId.toString())
  if (!tranchedPoolToken) {
    return
  }

  const poolAddress = tranchedPoolToken.tranchedPool
  const user = getOrInitUser(userAddress)

  const id = `${poolAddress}-${userAddress.toHexString()}`
  let poolBacker = PoolBacker.load(id)

  if (!poolBacker) {
    poolBacker = new PoolBacker(id)
  }

  let principalAmount = new BigInt(0)
  let principalRedeemed = new BigInt(0)
  let interestRedeemed = new BigInt(0)
  let interestRedeemable = new BigInt(0)
  let principalRedeemable = new BigInt(0)

  let tokens = user.tokens
  if (tokens){
    for (let i = 0, k = tokens.length; i < k; ++i) {
      let tokenId = tokens[i]
      if (tokenId) {
        const tokenInfo = TranchedPoolToken.load(tokenId)
        if (tokenInfo) {
          principalAmount = principalAmount.plus(tokenInfo.principalAmount)
          principalRedeemed = principalRedeemed.plus(tokenInfo.principalRedeemed)
          interestRedeemed = interestRedeemed.plus(tokenInfo.interestRedeemed)

          const poolContract = TranchedPoolContract.bind(Address.fromString(poolAddress))
          const availableToWithdraw = poolContract.availableToWithdraw(BigInt.fromString(tokenId))
          tokenInfo.interestRedeemable = availableToWithdraw.value0
          tokenInfo.principalRedeemable = availableToWithdraw.value1
          tokenInfo.save()

          interestRedeemable = interestRedeemable.plus(tokenInfo.interestRedeemable)
          principalRedeemable = principalRedeemable.plus(tokenInfo.principalRedeemable)
        }
      }
    }
  }

  const unusedPrincipal = principalRedeemed.plus(principalRedeemable)

  poolBacker.user = userAddress.toHexString()
  poolBacker.tranchedPool = poolAddress.toString()
  poolBacker.principalAmount = principalAmount
  poolBacker.principalRedeemed = principalRedeemed
  poolBacker.interestRedeemed = interestRedeemed
  poolBacker.principalAtRisk = principalAmount.minus(unusedPrincipal)
  poolBacker.balance = principalAmount.minus(principalRedeemed).plus(interestRedeemable)
  poolBacker.availableToWithdraw = interestRedeemable.plus(principalRedeemable)
  poolBacker.unrealizedGains = interestRedeemable
  poolBacker.principalRedeemable = principalRedeemable
  poolBacker.interestRedeemable = interestRedeemable
  poolBacker.save()
}
