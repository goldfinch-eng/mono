import {BlockInfo} from "../utils"

export function checkSameBlock(currentBlock: BlockInfo, ...deps: Array<BlockInfo>): void {
  deps.forEach((dep: BlockInfo) => {
    if (currentBlock.number !== dep.number) {
      const message = `Dependency block number differs from current block number (${currentBlock.number}): ${dep.number}`
      if (process.env.NODE_ENV === "development" && process.env.REACT_APP_MURMURATION !== "yes") {
        throw new Error(message)
      } else {
        console.error(message)
      }
    }
  })
}
