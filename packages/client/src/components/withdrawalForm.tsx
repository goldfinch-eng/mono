import {usdcFromAtomic, minimumNumber, usdcToAtomic} from "../ethereum/erc20"
import {displayDollars, displayNumber, roundDownPenny} from "../utils"
import {AppContext} from "../App"
import TransactionForm from "./transactionForm"
import TransactionInput from "./transactionInput"
import LoadingButton from "./loadingButton"
import useSendFromUser from "../hooks/useSendFromUser"
import useNonNullContext from "../hooks/useNonNullContext"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import {GFI_DECIMALS} from "../ethereum/gfi"
import BigNumber from "bignumber.js"

interface WithdrawalFormProps {
  poolData: PoolData
  capitalProvider: CapitalProvider
  actionComplete: () => void
  closeForm: () => void
}

function WithdrawalForm(props: WithdrawalFormProps) {
  const sendFromUser = useSendFromUser()
  const {pool, goldfinchConfig} = useNonNullContext(AppContext)

  function action({transactionAmount}) {
    const withdrawalAmount = usdcToAtomic(transactionAmount)
    return sendFromUser(pool.contract.methods.withdraw(withdrawalAmount), {
      type: "Withdrawal",
      amount: transactionAmount,
    }).then(props.actionComplete)
  }

  const availableAmount = props.capitalProvider.availableToWithdrawInDollars
  const availableToWithdraw = minimumNumber(
    availableAmount,
    usdcFromAtomic(props.poolData.balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit)
  )

  function renderForm({formMethods}) {
    const lastVestingEnd = props.capitalProvider.stakingRewards.hasUnvested
      ? new Date(props.capitalProvider.stakingRewards.lastVestingEndTime * 1000)
      : undefined
    // NOTE: The figure we show about how much GFI will be forfeited because it is unvested has
    // some element of imprecision; it should be considered an estimate. That's because the actual
    // amount forfeited is determined at the time of executing the unstaking transaction, and the
    // unstaking transaction causes its own checkpointing / updating of rewards info. So the sum
    // of unvested rewards we have computed here, as the basis for telling the user how much unvested
    // rewards their withdrawal entails forfeiting, will not necessarily equal the amount that will
    // actually be forfeited when the transaction is executed.
    const forfeitAdvisory = props.capitalProvider.stakingRewards.hasUnvested ? (
      <div className="form-message paragraph">
        You have {displayNumber(props.capitalProvider.stakingRewards.unvested.div(GFI_DECIMALS.toString()), 2)} GFI (
        {displayDollars(props.capitalProvider.stakingRewards.unvestedInDollars, 2)}) that is still vesting until{" "}
        {lastVestingEnd!.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
        . If you withdraw before then, you will forfeit a portion of your unvested GFI.
      </div>
    ) : undefined
    const protocolFeeAdvisory = (
      <div className="form-message paragraph">
        {forfeitAdvisory ? "Also as a reminder," : "Note that"} the protocol will deduct a 0.50% fee from your
        withdrawal amount for protocol reserves.
      </div>
    )
    return (
      <div className="form-inputs">
        {forfeitAdvisory}
        {protocolFeeAdvisory}
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            maxAmount={availableToWithdraw}
            rightDecoration={
              <button
                className="enter-max-amount"
                type="button"
                onClick={() => {
                  formMethods.setValue("transactionAmount", roundDownPenny(availableToWithdraw), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }}
              >
                Max
              </button>
            }
            notes={[
              {
                key: "advisory",
                content: (
                  <p>
                    You will <span className="font-bold">receive {displayDollars(new BigNumber(0), 2)}</span>
                    {" net of protocol reserves and "}
                    <span className="font-bold">
                      forfeit {displayNumber(new BigNumber(0), 2)} GFI ({displayDollars(new BigNumber(0), 2)})
                    </span>{" "}
                    that is still unvested.
                  </p>
                ),
              },
            ]}
          />
          <LoadingButton action={action} />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(availableAmount)}`}
      render={renderForm}
      closeForm={props.closeForm}
      maxAmount={availableToWithdraw}
    />
  )
}

export default WithdrawalForm
