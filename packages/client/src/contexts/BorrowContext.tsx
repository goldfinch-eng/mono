import React, {useState} from "react"
import {CreditLine} from "../ethereum/creditLine"

interface BorrowStoreType {
  creditLine: CreditLine | undefined
}

interface BorrowProviderProps {
  children: React.ReactNode
}

interface BorrowContextType {
  borrowStore: BorrowStoreType
  setBorrowStore: (BorrowStoreType) => void
}

const BorrowContext = React.createContext<BorrowContextType | undefined>(undefined)

function BorrowProvider({children}: BorrowProviderProps) {
  const [borrowStore, setBorrowStore] = useState<BorrowStoreType>({
    creditLine: undefined,
  })

  const value = {borrowStore, setBorrowStore}

  return <BorrowContext.Provider value={value}>{children}</BorrowContext.Provider>
}

function useBorrow() {
  const context = React.useContext(BorrowContext)
  if (context === undefined) {
    throw new Error("useBorrow must be used within a BorrowProvider")
  }
  return context
}

export {BorrowProvider, useBorrow}
