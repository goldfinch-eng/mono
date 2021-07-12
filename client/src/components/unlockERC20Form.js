import React from "react"
import BigNumber from "bignumber.js"
import { MAX_UINT } from "../ethereum/utils"
import LoadingButton from "./loadingButton"
import { useForm, FormProvider } from "react-hook-form"
import { iconInfo } from "./icons.js"
import useSendFromUser from "../hooks/useSendFromUser"
import { usdcFromAtomic } from "../ethereum/erc20"

function UnlockERC20Form(props) {
  const { erc20, onUnlock, unlockAddress } = props
  const sendFromUser = useSendFromUser()
  const formMethods = useForm()

  const unlock = () => {
    // The txData parameters must use the schema defined in src/ethereum/events:mapEventToTx
    return sendFromUser(erc20.contract.methods.approve(unlockAddress, MAX_UINT), {
      type: "Approval",
      amount: usdcFromAtomic(MAX_UINT),
      amountBN: new BigNumber(MAX_UINT),
      erc20: erc20,
    }).then(onUnlock)
  }

  return (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container">
        <div className="message">
          {iconInfo}
          <p>Just this one time, you’ll first need to unlock your account to use {erc20.ticker} with Goldfinch.</p>
        </div>
        <LoadingButton action={unlock} text={`Unlock ${erc20.ticker}`} />
      </div>
    </FormProvider>
  )
}

export default UnlockERC20Form
