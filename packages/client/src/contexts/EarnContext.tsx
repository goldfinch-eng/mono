import {ApolloError} from "@apollo/client"
import React, {useEffect, useState} from "react"
import {SeniorPoolStatus} from "../components/earn"
import {CapitalProvider} from "../ethereum/pool"
import {PoolBacker} from "../ethereum/tranchedPool"
import {usePoolBackersWeb3, useSeniorPoolStatusWeb3, useTranchedPoolSubgraphData} from "../hooks/useEarnData"
import {UseGraphQuerierConfig} from "../hooks/useGraphQuerier"
import {Loadable} from "../types/loadable"
import {shouldUseWeb3} from "../utils"

interface EarnStoreType {
  capitalProvider: Loadable<CapitalProvider>
  backers: Loadable<PoolBacker[]>
  seniorPoolStatus: Loadable<SeniorPoolStatus>
  poolsAddresses: Loadable<string[]>
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

export function usePoolsData(
  capitalProvider: Loadable<CapitalProvider>,
  graphQuerierConfig: UseGraphQuerierConfig,
  useWeb3 = false
): {
  backers: Loadable<PoolBacker[]>
  seniorPoolStatus: Loadable<SeniorPoolStatus>
  poolsAddresses: Loadable<string[]>
  graphError: ApolloError | undefined
} {
  // Fetch data from subgraph
  const {error: graphError, backers: backersSubgraph} = useTranchedPoolSubgraphData(graphQuerierConfig, useWeb3)

  // Fetch data from web3 provider
  const {backers: backersWeb3, poolsAddresses: poolsAddressesWeb3} = usePoolBackersWeb3(!useWeb3)
  const {seniorPoolStatus: seniorPoolStatusWeb3} = useSeniorPoolStatusWeb3(capitalProvider)

  const seniorPoolStatusData = seniorPoolStatusWeb3
  const backersData = useWeb3 ? backersWeb3 : backersSubgraph
  const poolsAddressesData: Loadable<string[]> = useWeb3
    ? poolsAddressesWeb3
    : {
        loaded: false,
        value: undefined,
      }

  return {
    backers: backersData,
    graphError,
    poolsAddresses: poolsAddressesData,
    seniorPoolStatus: seniorPoolStatusData,
  }
}

function EarnProvider(props: EarnProviderProps) {
  const [useWeb3, setUseWeb3] = useState<boolean>(shouldUseWeb3())
  const [earnStore, setEarnStore] = useState<EarnStoreType>({
    capitalProvider: {
      loaded: false,
      value: undefined,
    },
    backers: {
      loaded: false,
      value: undefined,
    },
    poolsAddresses: {
      loaded: false,
      value: undefined,
    },
    seniorPoolStatus: {
      loaded: false,
      value: undefined,
    },
  })

  const {backers, poolsAddresses, graphError, seniorPoolStatus} = usePoolsData(
    earnStore.capitalProvider,
    props.graphQuerierConfig,
    useWeb3
  )

  useEffect(() => {
    if (graphError) {
      console.error("Activating fallback to Web3.", graphError)
      setUseWeb3(true)
    }
  }, [graphError])

  const value = {
    earnStore: {
      ...earnStore,
      backers,
      poolsAddresses,
      seniorPoolStatus,
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
