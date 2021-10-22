import {BlockInfo, getBlockInfo, getCurrentBlock} from "../utils"
import {useAsync} from "./useAsync"

export default function useCurrentBlock(): BlockInfo | undefined {
  const currentBlock = useAsync(() => getCurrentBlock(), [])
  if (currentBlock.status === "succeeded") {
    return getBlockInfo(currentBlock.value)
  }
  return
}
