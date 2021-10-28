import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {GFI} from "../ethereum/gfi"

export function useGFIBalance() {
  const {user, goldfinchProtocol} = useContext(AppContext)
  const [gfiBalance, setGfiBalance] = useState<BigNumber>()

  useEffect(() => {
    if (!goldfinchProtocol || !user || !user.address) return
    const getGFIBalance = async (goldfinchProtocol) => {
      const gfi = new GFI(goldfinchProtocol)
      await gfi.initialize()
      const balance = await gfi.contract.methods.balanceOf(user.address).call()
      setGfiBalance(new BigNumber(balance))
    }

    getGFIBalance(goldfinchProtocol)
  }, [goldfinchProtocol, user, user.address])

  return gfiBalance
}
