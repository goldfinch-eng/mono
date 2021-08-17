import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {AsyncResult, RefreshFn, useAsync, useAsyncFn} from "./useAsync"
import {Backer, TranchedPool} from "../ethereum/tranchedPool"
import {useContext, useEffect} from "react"
import {User} from "../ethereum/user"
import {AppContext} from "../App"
import {BigNumber} from "bignumber.js"

function useTranchedPool({
  goldfinchProtocol,
  address,
}: {
  goldfinchProtocol?: GoldfinchProtocol
  address: string
}): [AsyncResult<TranchedPool>, RefreshFn] {
  let [result, refresh] = useAsyncFn<TranchedPool>(() => {
    if (!goldfinchProtocol) {
      return
    }

    let tranchedPool = new TranchedPool(address, goldfinchProtocol)
    return tranchedPool.initialize().then(() => tranchedPool)
  }, [address, goldfinchProtocol])

  useEffect(refresh, [refresh])

  return [result, refresh]
}

function useBacker({user, tranchedPool}: {user: User; tranchedPool?: TranchedPool}): Backer | undefined {
  const {goldfinchProtocol} = useContext(AppContext)
  let backerResult = useAsync<Backer>(() => {
    if (!user.loaded || !tranchedPool || !goldfinchProtocol) {
      return
    }

    let backer = new Backer(user.address, tranchedPool, goldfinchProtocol)
    return backer.initialize().then(() => backer)
  }, [user, tranchedPool, goldfinchProtocol])

  if (backerResult.status === "succeeded") {
    return backerResult.value
  }
  return
}

function useEstimatedSeniorPoolContribution({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let {pool} = useContext(AppContext)
  let estimatedContribution = useAsync(
    () => pool && tranchedPool && pool.contract.methods.estimateInvestment(tranchedPool.address).call(),
    [pool, tranchedPool],
  )

  if (estimatedContribution.status === "succeeded") {
    return new BigNumber(estimatedContribution.value)
  }

  return
}

function useEstimatedLeverageRatio({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let estimatedTotalAssets = useEstimatedTotalPoolAssets({tranchedPool})
  let juniorContribution = tranchedPool?.juniorTranche.principalDeposited

  if (estimatedTotalAssets && juniorContribution) {
    // When the pool is empty, assume max leverage
    if (new BigNumber(juniorContribution).isZero()) {
      // TODO: This is currently hardcoded, we'll pull it from config when it's available.
      return new BigNumber(4)
    }
    return estimatedTotalAssets.minus(juniorContribution).dividedBy(juniorContribution)
  }

  return
}

function useEstimatedTotalPoolAssets({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let estimatedSeniorPoolContribution = useEstimatedSeniorPoolContribution({tranchedPool})
  let juniorContribution = tranchedPool?.juniorTranche.principalDeposited
  let seniorContribution = tranchedPool?.seniorTranche.principalDeposited

  if (estimatedSeniorPoolContribution && juniorContribution && seniorContribution) {
    return estimatedSeniorPoolContribution.plus(juniorContribution).plus(seniorContribution)
  }

  return
}

function useRemainingCapacity({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let estimatedTotalPoolAssets = useEstimatedTotalPoolAssets({tranchedPool})
  let capacity

  if (estimatedTotalPoolAssets && tranchedPool) {
    capacity = tranchedPool.creditLine.limit.minus(estimatedTotalPoolAssets)
  }

  return capacity
}

function useRemainingJuniorCapacity({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  const remainingCapacity = useRemainingCapacity({tranchedPool})
  const estimatedLeverageRatio = useEstimatedLeverageRatio({tranchedPool})

  if (remainingCapacity && estimatedLeverageRatio) {
    return remainingCapacity.dividedBy(estimatedLeverageRatio.plus(1))
  }

  return
}

export {
  useTranchedPool,
  useBacker,
  useEstimatedLeverageRatio,
  useRemainingJuniorCapacity,
  useRemainingCapacity,
  useEstimatedSeniorPoolContribution,
  useEstimatedTotalPoolAssets,
}
