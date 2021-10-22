import React, {useState} from "react"
import {CapitalProvider, emptyCapitalProvider} from "../ethereum/pool"
import {PoolBacker} from "../ethereum/tranchedPool"

interface EarnStoreType {
  capitalProvider: CapitalProvider
  backers: PoolBacker[]
}
interface EarnProviderProps {
  children: React.ReactNode
}

interface EarnContextType {
  earnStore: EarnStoreType
  setEarnStore: (EarnStoreType) => void
}

const EarnContext = React.createContext<EarnContextType | undefined>(undefined)

function EarnProvider({children}: EarnProviderProps) {
  const [earnStore, setEarnStore] = useState<EarnStoreType>({
    capitalProvider: emptyCapitalProvider(),
    backers: new Array<PoolBacker>(),
  })

  const value = {earnStore, setEarnStore}

  return <EarnContext.Provider value={value}>{children}</EarnContext.Provider>
}

function useEarn() {
  const context = React.useContext(EarnContext)
  if (context === undefined) {
    throw new Error("useEarn must be used within a EarnProvider")
  }
  return context
}

export {EarnProvider, useEarn}
