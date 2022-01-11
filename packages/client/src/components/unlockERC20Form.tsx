import React from "react"
import BigNumber from "bignumber.js"
import {MAX_UINT} from "../ethereum/utils"
import LoadingButton from "./loadingButton"
import {useForm, FormProvider} from "react-hook-form"
import {iconInfo} from "./icons"
import useSendFromUser from "../hooks/useSendFromUser"
import {ERC20, usdcFromAtomic} from "../ethereum/erc20"
import {assertNonNullable} from "../utils"
import {ERC20_APPROVAL_TX_TYPE} from "../types/transactions"

type UnlockERC20Props = {
  erc20: ERC20 | undefined
  onUnlock: () => Promise<void>
  unlockAddress: string
}

function UnlockERC20Form(props: UnlockERC20Props) {
  const {erc20, onUnlock, unlockAddress} = props
  const sendFromUser = useSendFromUser()
  const formMethods = useForm()

  const unlock = () => {
    assertNonNullable(erc20)
    // The txData parameters must use the schema defined in src/ethereum/events:mapEventToTx
    return sendFromUser(erc20.contract.userWallet.methods.approve(unlockAddress, MAX_UINT), {
      type: ERC20_APPROVAL_TX_TYPE,
      data: {
        amount: usdcFromAtomic(MAX_UINT.toString()),
        // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'BN' is not assignable to paramet... Remove this comment to see the full error message
        amountBN: new BigNumber(MAX_UINT),
        erc20: erc20,
      },
    }).then(onUnlock)
  }

  return erc20 ? (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container">
        <div className="message small">
          {iconInfo}
          <p>Just this one time, you’ll first need to unlock your account to use {erc20.ticker} with Goldfinch.</p>
        </div>
        <LoadingButton action={unlock} text={`Unlock ${erc20.ticker}`} />
      </div>
    </FormProvider>
  ) : null
}

export default UnlockERC20Form
