import {BigNumber} from "bignumber.js"
import {AppContext} from "../../App"
import {usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import useNonNullContext from "../../hooks/useNonNullContext"
import useSendFromUser from "../../hooks/useSendFromUser"
import {WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE} from "../../types/transactions"
import {displayDollars, roundDownPenny} from "../../utils"
import LoadingButton from "../loadingButton"
import TransactionForm from "../transactionForm"
import TransactionInput from "../transactionInput"
import {splitWithdrawAmount} from "./splitWithdrawAmount"

export function TranchedPoolWithdrawForm({
  backer,
  tranchedPool,
  actionComplete,
  closeForm,
}: {
  backer: TranchedPoolBacker
  tranchedPool: TranchedPool
  actionComplete: () => void
  closeForm: () => void
}) {
  const {goldfinchConfig} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()

  async function action({transactionAmount}) {
    const withdrawAmount = usdcToAtomic(transactionAmount)
    let firstToken = backer.tokenInfos[0]!
    if (new BigNumber(withdrawAmount).gt(firstToken.principalRedeemable.plus(firstToken.interestRedeemable))) {
      let splits = splitWithdrawAmount(new BigNumber(withdrawAmount), backer.tokenInfos)
      return sendFromUser(tranchedPool.contract.userWallet.methods.withdrawMultiple(splits.tokenIds, splits.amounts), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      }).then(actionComplete)
    } else {
      return sendFromUser(tranchedPool.contract.userWallet.methods.withdraw(backer.tokenInfos[0]!.id, withdrawAmount), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      }).then(actionComplete)
    }
  }

  function renderForm({formMethods}) {
    return (
      <div className="form-inputs">
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            maxAmount={backer.availableToWithdrawInDollars.toString(10)}
            rightDecoration={
              <button
                className="enter-max-amount"
                type="button"
                onClick={() => {
                  formMethods.setValue("transactionAmount", roundDownPenny(backer.availableToWithdrawInDollars), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }}
              >
                Max
              </button>
            }
            validations={{
              transactionLimit: (value) =>
                goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                `This is over the per-transaction limit of ${displayDollars(
                  usdcFromAtomic(goldfinchConfig.transactionLimit),
                  0
                )}`,
            }}
          />
          <LoadingButton action={action} />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(backer.availableToWithdrawInDollars)}`}
      render={renderForm}
      closeForm={closeForm}
    />
  )
}
