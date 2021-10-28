import {useContext} from "react"
import {AppContext} from "../App"
import {MerkleDistributor, MerkleDistributorLoaded} from "../ethereum/communityRewards"
import {assertWithLoadedInfo} from "../types/loadable"
import {useAsync, useStaleWhileRevalidating} from "./useAsync"

export function useMerkleDistributor(): MerkleDistributorLoaded | undefined {
  const {goldfinchProtocol, user} = useContext(AppContext)

  const merkleDistributorResult = useAsync<MerkleDistributorLoaded>(() => {
    if (!user.loaded || !goldfinchProtocol) {
      return
    }

    const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
    return merkleDistributor.initialize(user.address).then((): MerkleDistributorLoaded => {
      assertWithLoadedInfo(merkleDistributor)
      return merkleDistributor
    })
  }, [goldfinchProtocol, user])

  const merkleDistributor = useStaleWhileRevalidating(merkleDistributorResult)

  return merkleDistributor
}
