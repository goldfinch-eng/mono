import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {GFI} from "../ethereum/gfi"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {BlockInfo} from "../utils"

export function useGFIBalance() {
  const {user, goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [gfiBalance, setGfiBalance] = useState<BigNumber>()

  useEffect(() => {
    if (!goldfinchProtocol || !user.address || !currentBlock) return

    async function getGFIBalance(goldfinchProtocol: GoldfinchProtocol, userAddress: string, currentBlock: BlockInfo) {
      const gfi = new GFI(goldfinchProtocol)
      await gfi.initialize(currentBlock)
      const balance = await gfi.contract.methods.balanceOf(userAddress).call(undefined, currentBlock.number)
      setGfiBalance(new BigNumber(balance))
    }

    getGFIBalance(goldfinchProtocol, user.address, currentBlock)
  }, [goldfinchProtocol, user.address, currentBlock])

  return gfiBalance
}
