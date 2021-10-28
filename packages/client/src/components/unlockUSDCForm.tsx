import React, {useContext} from "react"
import {AppContext} from "../App"
import UnlockERC20Form from "./unlockERC20Form"

type UnlockUSDCFormProps = {
  unlockAddress: string
}

function UnlockUSDCForm(props: UnlockUSDCFormProps) {
  const {usdc, refreshCurrentBlock} = useContext(AppContext)
  const {unlockAddress} = props

  return usdc && refreshCurrentBlock ? (
    <UnlockERC20Form erc20={usdc} onUnlock={refreshCurrentBlock} unlockAddress={unlockAddress} />
  ) : null
}

export default UnlockUSDCForm
