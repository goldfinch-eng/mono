import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {assertNonNullable, BlockInfo} from "../utils"

type UseFromSameBlockConfig = {
  // Whether, upon a change in the `currentBlock` passed to the hook or in the `deps` dependencies,
  // the `currentBlock` should be set as the leaf current block in app state, if `currentBlock`
  // matches the current block of all the `deps`.
  setAsLeaf: boolean
}

type InfoWithCurrentBlock = {currentBlock: BlockInfo}

export function useFromSameBlock<
  T extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  U extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>
>(
  config: UseFromSameBlockConfig,
  currentBlock: BlockInfo | undefined,
  ...deps: [T | undefined, U | undefined]
): [T, U] | undefined

export function useFromSameBlock<
  T extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  U extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  V extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>
>(
  config: UseFromSameBlockConfig,
  currentBlock: BlockInfo | undefined,
  ...deps: [T | undefined, U | undefined, V | undefined]
): [T, U, V] | undefined

export function useFromSameBlock<
  T extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  U extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  V extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  W extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>
>(
  config: UseFromSameBlockConfig,
  currentBlock: BlockInfo | undefined,
  ...deps: [T | undefined, U | undefined, V | undefined, W | undefined]
): [T, U, V, W] | undefined

export function useFromSameBlock<
  T extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  U extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  V extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  W extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>,
  X extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>
>(
  config: UseFromSameBlockConfig,
  currentBlock: BlockInfo | undefined,
  ...deps: [T | undefined, U | undefined, V | undefined, W | undefined, X | undefined]
): [T, U, V, W, X] | undefined

/**
 * Hook for ensuring that the loadable items provided to it are all loaded with
 * data from the same block. Note that this hook does not actually perform any
 * loading; that is the responsibility of each item. This hook simply ensures
 * that the values returned by this hook will not change until those values are
 * all consistent with each other with respect to being based on the same block:
 * the current block.
 *
 * ASSUMPTION: The provided items are all immutable in relation to their respective `info`s.
 * Thus we can use the items themselves as the dependencies passed to `useEffect()` to determine
 * when to re-evaluate the effect.
 */
export function useFromSameBlock<
  T extends WithLoadedInfo<{info: Loadable<InfoWithCurrentBlock>}, InfoWithCurrentBlock>
>(config: UseFromSameBlockConfig, currentBlock: BlockInfo | undefined, ...deps: Array<T | undefined>): T[] | undefined {
  const {setLeafCurrentBlock} = useContext(AppContext)
  const [value, setValue] = useState<T[]>()

  useEffect(() => {
    if (currentBlock) {
      const reduced = deps.reduce<T[] | undefined>((acc, curr) => {
        if (acc) {
          if (curr?.info.value.currentBlock.number === currentBlock.number) {
            return acc.concat([curr])
          } else {
            return undefined
          }
        } else {
          return acc
        }
      }, [])
      if (reduced && reduced.length) {
        setValue(reduced)

        if (config.setAsLeaf) {
          assertNonNullable(setLeafCurrentBlock)
          setLeafCurrentBlock(currentBlock)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, currentBlock?.number])

  return value
}
