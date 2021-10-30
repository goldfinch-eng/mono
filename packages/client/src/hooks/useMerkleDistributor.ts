import {useContext} from "react"
import {AppContext} from "../App"
import {MerkleDistributor, MerkleDistributorLoaded} from "../ethereum/communityRewards"
import {assertWithLoadedInfo} from "../types/loadable"
import {useAsync, useStaleWhileRevalidating} from "./useAsync"

export function useMerkleDistributor(): MerkleDistributorLoaded | undefined {
  const {goldfinchProtocol, user, currentBlock} = useContext(AppContext)

  const merkleDistributorResult = useAsync<MerkleDistributorLoaded>(() => {
    if (!user || !goldfinchProtocol || !currentBlock) {
      return
    }

    const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
    return merkleDistributor.initialize(user.address, currentBlock).then((): MerkleDistributorLoaded => {
      assertWithLoadedInfo(merkleDistributor)
      return merkleDistributor
    })
  }, [goldfinchProtocol, user, currentBlock])

  const merkleDistributor = useStaleWhileRevalidating(merkleDistributorResult)

  return merkleDistributor
}
