import React, {useState} from "react"
import {CapitalProvider} from "../ethereum/pool"
import {PoolBacker} from "../ethereum/tranchedPool"
import {Loadable} from "../types/loadable"

interface EarnStoreType {
  capitalProvider: Loadable<CapitalProvider>
  backers: Loadable<PoolBacker[]>
}
interface EarnProviderProps {
  children: React.ReactNode
}

interface EarnContextType {
  earnStore: EarnStoreType
  setEarnStore: (val: EarnStoreType) => void
}

const EarnContext = React.createContext<EarnContextType | undefined>(undefined)

function EarnProvider({children}: EarnProviderProps) {
  const [earnStore, setEarnStore] = useState<EarnStoreType>({
    capitalProvider: {
      loaded: false,
      value: undefined,
    },
    backers: {
      loaded: false,
      value: undefined,
    },
  })

  const value = {earnStore, setEarnStore}

  return <EarnContext.Provider value={value}>{children}</EarnContext.Provider>
}

function useEarn() {
  const context = React.useContext(EarnContext)
  if (context === undefined) {
    throw new Error("useEarn must be used within an EarnProvider")
  }
  return context
}

export {EarnProvider, useEarn}
