import {Address, BigInt, log} from "@graphprotocol/graph-ts"
import {PoolBacker, TranchedPool, TranchedPoolToken} from "../../generated/schema"
import {TranchedPool as TranchedPoolContract} from "../../generated/templates/PoolTokens/TranchedPool"
import {BackerRewards as BackerRewardsContract} from "../../generated/templates/BackerRewards/BackerRewards"
import {getGoldfinchConfig} from "./helpers"
import {CONFIG_KEYS_ADDRESSES} from "../constants"

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
    poolBacker.save()
  }
  return poolBacker
}

export function updatePoolBacker(userAddress: Address, tranchedPoolAddress: Address): void {
  let poolAddressStr = tranchedPoolAddress.toHexString()
  let currentBackerStr = userAddress.toHexString()
  const id = `${poolAddressStr}-${currentBackerStr}`

  let poolBacker = PoolBacker.load(id)
  if (!poolBacker) {
    poolBacker = new PoolBacker(id)
  }

  let principalAmount = new BigInt(0)
  let principalRedeemed = new BigInt(0)
  let interestRedeemed = new BigInt(0)
  let interestRedeemable = new BigInt(0)
  let principalRedeemable = new BigInt(0)

  let tranchedPool = TranchedPool.load(poolAddressStr)
  if (!tranchedPool) {
    // There's one scenario where the Transfer event happens before the PoolCreated. This check is required
    // because handleTransfer triggers updates on the involved backers
    return
  }

  let tokens = tranchedPool.tokens
  if (tokens) {
    for (let i = 0, k = tokens.length; i < k; ++i) {
      let tokenId = assert(tokens[i])

      const tokenInfo = assert(TranchedPoolToken.load(tokenId))

      let userAddr = tokenInfo.user.toString()
      if (userAddr == currentBackerStr) {
        principalAmount = principalAmount.plus(tokenInfo.principalAmount)
        principalRedeemed = principalRedeemed.plus(tokenInfo.principalRedeemed)
        interestRedeemed = interestRedeemed.plus(tokenInfo.interestRedeemed)

        const poolContract = TranchedPoolContract.bind(Address.fromString(poolAddressStr))
        let callResult = poolContract.try_availableToWithdraw(BigInt.fromString(tokenId))
        if (callResult.reverted) {
          log.warning("availableToWithdraw reverted for pool {} and backer {}", [poolAddressStr, currentBackerStr])
        } else {
          tokenInfo.interestRedeemable = callResult.value.value0
          tokenInfo.principalRedeemable = callResult.value.value1
        }
        tokenInfo.save()

        interestRedeemable = interestRedeemable.plus(tokenInfo.interestRedeemable)
        principalRedeemable = principalRedeemable.plus(tokenInfo.principalRedeemable)
      }
    }
  }

  const unusedPrincipal = principalRedeemed.plus(principalRedeemable)
  poolBacker.user = userAddress.toHexString()
  poolBacker.tranchedPool = tranchedPoolAddress.toHexString()
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

export function updateAllPoolBackers(address: Address): void {
  let tranchedPoolAddress = address.toHexString()
  let tranchedPool = assert(TranchedPool.load(tranchedPoolAddress))
  const backers = tranchedPool.backers

  if (backers) {
    for (let i = 0, k = backers.length; i < k; ++i) {
      let backer = assert(backers[i])
      let poolBacker = assert(PoolBacker.load(backer))
      updatePoolBacker(Address.fromString(poolBacker.user), Address.fromString(tranchedPoolAddress))
    }
  }
}

function updatePoolBackerRewardsClaimable(poolBacker: PoolBacker, backerRewardsContract: BackerRewardsContract): void {
  const tranchedPool = assert(TranchedPool.load(poolBacker.tranchedPool))
  const poolTokenIds = tranchedPool.tokens

  poolBacker.rewardsClaimable = BigInt.zero()
  for (let i = 0; i < poolTokenIds.length; i++) {
    const poolTokenId = poolTokenIds[i]
    const poolToken = assert(TranchedPoolToken.load(poolTokenId))
    if (poolToken.user == poolBacker.user) {
      poolToken.rewardsClaimable = backerRewardsContract.poolTokenClaimableRewards(BigInt.fromString(poolTokenId))
      poolToken.stakingRewardsClaimable = backerRewardsContract.stakingRewardsEarnedSinceLastWithdraw(
        BigInt.fromString(poolTokenId)
      )
      poolToken.save()
      poolBacker.rewardsClaimable = poolBacker.rewardsClaimable.plus(poolToken.rewardsClaimable)
    }
  }
  poolBacker.save()
}

export function updateAllPoolBackersRewardsClaimable(tranchedPoolAddress: Address, blockTimestamp: BigInt): void {
  const tranchedPool = assert(TranchedPool.load(tranchedPoolAddress.toHexString()))
  const poolBackers = tranchedPool.backers
  const goldfinchConfig = getGoldfinchConfig(blockTimestamp)
  const backerRewardsContractAddress = goldfinchConfig.getAddress(BigInt.fromI32(CONFIG_KEYS_ADDRESSES.BackerRewards))
  if (backerRewardsContractAddress.equals(Address.zero())) {
    return
  }
  const backerRewardsContract = BackerRewardsContract.bind(backerRewardsContractAddress)
  for (let i = 0; i < poolBackers.length; i++) {
    const poolBacker = assert(PoolBacker.load(poolBackers[i]))
    updatePoolBackerRewardsClaimable(poolBacker, backerRewardsContract)
  }
}
