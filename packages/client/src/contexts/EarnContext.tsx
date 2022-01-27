import {ApolloError} from "@apollo/client"
import React, {useEffect, useState} from "react"
import {SeniorPoolStatus} from "../components/Earn/types"
import {CapitalProvider} from "../ethereum/pool"
import {TranchedPoolBacker} from "../ethereum/tranchedPool"
import {usePoolBackersWeb3, useSeniorPoolStatusWeb3, useTranchedPoolSubgraphData} from "../hooks/useEarnData"
import {UseGraphQuerierConfig} from "../hooks/useGraphQuerier"
import {Loadable} from "../types/loadable"
import {shouldUseWeb3} from "../utils"

interface EarnStoreType {
  seniorPoolStatus: Loadable<SeniorPoolStatus>
  capitalProvider: Loadable<CapitalProvider>
  poolsAddresses: Loadable<string[]>
  backers: Loadable<TranchedPoolBacker[]>
}
interface EarnProviderProps {
  graphQuerierConfig: UseGraphQuerierConfig
  children: React.ReactNode
}

interface EarnContextType {
  earnStore: EarnStoreType
  setEarnStore: (val: EarnStoreType) => void
}

const EarnContext = React.createContext<EarnContextType | undefined>(undefined)

function useSeniorPoolData(capitalProvider: Loadable<CapitalProvider>): {
  seniorPoolStatus: Loadable<SeniorPoolStatus>
} {
  const {seniorPoolStatus} = useSeniorPoolStatusWeb3(capitalProvider)
  return {
    seniorPoolStatus,
  }
}

function useTranchedPoolsData(
  graphQuerierConfig: UseGraphQuerierConfig,
  useWeb3 = false
): {
  backers: Loadable<TranchedPoolBacker[]>
  poolsAddresses: Loadable<string[]>
  graphError: ApolloError | undefined
} {
  const {error: graphError, backers: backersSubgraph} = useTranchedPoolSubgraphData(graphQuerierConfig, useWeb3)
  const {backers: backersWeb3, poolsAddresses: poolsAddressesWeb3} = usePoolBackersWeb3(!useWeb3)
  const backers = useWeb3 ? backersWeb3 : backersSubgraph

  const poolsAddressesData: Loadable<string[]> = useWeb3
    ? poolsAddressesWeb3
    : {
        loaded: false,
        value: undefined,
      }

  return {
    backers,
    graphError,
    poolsAddresses: poolsAddressesData,
  }
}

function EarnProvider(props: EarnProviderProps) {
  const [useWeb3, setUseWeb3] = useState<boolean>(shouldUseWeb3())
  const [earnStore, setEarnStore] = useState<EarnStoreType>({
    seniorPoolStatus: {
      loaded: false,
      value: undefined,
    },
    capitalProvider: {
      loaded: false,
      value: undefined,
    },
    poolsAddresses: {
      loaded: false,
      value: undefined,
    },
    backers: {
      loaded: false,
      value: undefined,
    },
  })

  const {seniorPoolStatus} = useSeniorPoolData(earnStore.capitalProvider)
  const {backers, poolsAddresses, graphError} = useTranchedPoolsData(props.graphQuerierConfig, useWeb3)

  useEffect(() => {
    if (graphError) {
      console.error("Activating fallback to Web3.", graphError)
      setUseWeb3(true)
    }
  }, [graphError])

  const value = {
    earnStore: {
      ...earnStore,
      seniorPoolStatus,
      poolsAddresses,
      backers,
    },
    setEarnStore,
  }

  return <EarnContext.Provider value={value}>{props.children}</EarnContext.Provider>
}

function useEarn() {
  const context = React.useContext(EarnContext)
  if (context === undefined) {
    throw new Error("useEarn must be used within an EarnProvider")
  }
  return context
}

export {EarnProvider, useEarn}
