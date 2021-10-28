import {useEffect} from "react"
import {BlockInfo, getBlockInfo, getCurrentBlock} from "../utils"
import {RefreshFn, useAsyncFn, useStaleWhileRevalidating} from "./useAsync"

export default function useCurrentBlock(): [BlockInfo | undefined, RefreshFn] {
  let [result, refresh] = useAsyncFn<BlockInfo>((): Promise<BlockInfo> => {
    return getCurrentBlock().then((val) => getBlockInfo(val))
  }, [])
  const currentBlock = useStaleWhileRevalidating(result)

  useEffect(refresh, [refresh])

  return [currentBlock, refresh]
}
