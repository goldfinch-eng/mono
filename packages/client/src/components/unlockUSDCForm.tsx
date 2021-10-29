import React, {useContext} from "react"
import {AppContext} from "../App"
import {assertNonNullable} from "../utils"
import UnlockERC20Form from "./unlockERC20Form"

type UnlockUSDCFormProps = {
  unlockAddress: string
}

function UnlockUSDCForm(props: UnlockUSDCFormProps) {
  const {usdc, refreshCurrentBlock} = useContext(AppContext)
  const {unlockAddress} = props

  async function handleUnlock(): Promise<void> {
    assertNonNullable(refreshCurrentBlock)
    refreshCurrentBlock()
  }

  return <UnlockERC20Form erc20={usdc} onUnlock={handleUnlock} unlockAddress={unlockAddress} />
}

export default UnlockUSDCForm
