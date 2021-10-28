import BigNumber from "bignumber.js"
import {useState} from "react"
import {AppContext} from "../App"
import {getNumSharesFromUsdc, minimumNumber, usdcFromAtomic, usdcToAtomic} from "../ethereum/erc20"
import {fiduFromAtomic} from "../ethereum/fidu"
import {gfiInDollars, gfiFromAtomic, gfiToDollarsAtomic} from "../ethereum/gfi"
import {CapitalProvider, PoolData, StakingRewardsLoaded, StakingRewardsPosition} from "../ethereum/pool"
import useDebounce from "../hooks/useDebounce"
import useNonNullContext from "../hooks/useNonNullContext"
import useSendFromUser from "../hooks/useSendFromUser"
import {useStakingRewards} from "../hooks/useStakingRewards"
import {assertNonNullable, displayDollars, displayNumber, roundDownPenny} from "../utils"
import LoadingButton from "./loadingButton"
import TransactionForm from "./transactionForm"
import TransactionInput from "./transactionInput"

type UnstakeTokensAccumulator = {
  fiduSum: BigNumber
  forfeitedGfiSum: BigNumber
  tokens: Array<{
    tokenId: string
    fiduAmount: BigNumber
    forfeitedGfi: BigNumber
  }>
}

type WithdrawInfo = {
  fiduAmount: BigNumber
}
type UnstakeAndWithdrawInfo = UnstakeTokensAccumulator

type WithdrawalInfo =
  | {
      withdraw: WithdrawInfo
      unstakeAndWithdraw: UnstakeAndWithdrawInfo
    }
  | {
      withdraw: undefined
      unstakeAndWithdraw: UnstakeAndWithdrawInfo
    }
  | {
      withdraw: WithdrawInfo
      unstakeAndWithdraw: undefined
    }

interface WithdrawalFormProps {
  poolData: PoolData
  capitalProvider: CapitalProvider
  actionComplete: () => void
  closeForm: () => void
}

function WithdrawalForm(props: WithdrawalFormProps) {
  const {goldfinchConfig, pool} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()
  const stakingRewards = useStakingRewards()

  const [transactionAmount, setTransactionAmount] = useState()
  const debouncedSetTransactionAmount = useDebounce(setTransactionAmount, 200)

  function getWithdrawalInfo(withdrawalAmount: BigNumber, stakingRewards: StakingRewardsLoaded): WithdrawalInfo {
    const withdrawalFiduAmount = getNumSharesFromUsdc(withdrawalAmount, props.capitalProvider.sharePrice)

    if (withdrawalFiduAmount.gt(props.capitalProvider.shares.aggregates.withdrawable)) {
      throw new Error(
        `Tried to withdraw more shares (${withdrawalFiduAmount.toString(
          10
        )}) than are withdrawable (${props.capitalProvider.shares.aggregates.withdrawable.toString(10)}).`
      )
    }

    let withdrawalFiduAmountRemaining = withdrawalFiduAmount

    // If user holds any unstaked FIDU, withdraw that first. Prioritizing unstaked FIDU in this
    // way is intended to be user-friendly, because unstaked FIDU is not earning rewards.
    let withdraw: WithdrawInfo | undefined
    if (props.capitalProvider.shares.parts.notStaked.gt(0)) {
      const fiduAmount = BigNumber.min(withdrawalFiduAmountRemaining, props.capitalProvider.shares.parts.notStaked)

      withdraw = {fiduAmount}

      withdrawalFiduAmountRemaining = withdrawalFiduAmountRemaining.minus(fiduAmount)
    }

    // If the user's unstaked FIDU was not sufficient for the amount they want to withdraw, unstake-and-withdraw
    // from however many of their staked positions are necessary and sufficient for the remaining portion of the
    // amount they want to withdraw. To be user-friendly, we exit these positions in reverse order of their vesting
    // end time; positions whose rewards vesting schedule has not completed will be exited before positions whose
    // rewards vesting schedule has completed, which is desirable for the user as that maximizes the rate at which
    // they continue to earn vested (i.e. claimable) rewards. Also, note that among the (unstakeable) positions
    // whose rewards vesting schedule has completed, there is no reason to prefer exiting one position versus
    // another, as all such positions earn rewards at the same rate.
    let unstakeAndWithdraw: UnstakeAndWithdrawInfo | undefined
    if (withdrawalFiduAmountRemaining.gt(0)) {
      // TODO Refactor not to use `stakingRewards`. Refactor `props.capitalProvider` to provide the positions array
      // that must be iterated over.
      if (props.capitalProvider.currentBlock.number === stakingRewards.info.value.currentBlock.number) {
        const positions = stakingRewards.unstakeablePositions
        assertNonNullable(positions)
        const sorted = positions
          .slice()
          .sort((a, b) => a.storedPosition.rewards.endTime - b.storedPosition.rewards.endTime)
        const reduced = sorted.reduceRight<UnstakeTokensAccumulator>(
          (acc: UnstakeTokensAccumulator, curr: StakingRewardsPosition): UnstakeTokensAccumulator => {
            if (acc.fiduSum.lt(withdrawalFiduAmountRemaining)) {
              const fiduPortion = BigNumber.min(
                curr.storedPosition.amount,
                withdrawalFiduAmountRemaining.minus(acc.fiduSum)
              )
              let forfeitedGfiPortion: BigNumber
              if (curr.storedPosition.amount.eq(0)) {
                // Zero FIDU remaining on the position is possible via having fully unstaked.
                if (!curr.unvested.eq(0)) {
                  console.error("Expected zero unvested rewards if FIDU amount on position is 0.")
                }
                forfeitedGfiPortion = new BigNumber(0)
              } else {
                forfeitedGfiPortion = curr.unvested.multipliedBy(fiduPortion).dividedBy(curr.storedPosition.amount)
              }
              return {
                fiduSum: acc.fiduSum.plus(fiduPortion),
                forfeitedGfiSum: acc.forfeitedGfiSum.plus(forfeitedGfiPortion),
                tokens: acc.tokens.concat([
                  {
                    tokenId: curr.tokenId,
                    fiduAmount: fiduPortion,
                    forfeitedGfi: forfeitedGfiPortion,
                  },
                ]),
              }
            } else {
              return acc
            }
          },
          {
            fiduSum: new BigNumber(0),
            forfeitedGfiSum: new BigNumber(0),
            tokens: [],
          }
        )

        withdrawalFiduAmountRemaining = withdrawalFiduAmountRemaining.minus(reduced.fiduSum)
        if (!withdrawalFiduAmountRemaining.eq(0)) {
          throw new Error("Failed to prepare withdrawals of desired FIDU amount.")
        }

        unstakeAndWithdraw = reduced
      } else {
        throw new Error("`capitalProvider` and `stakingRewards` info are based on different blocks.")
      }
    }

    if (withdraw && unstakeAndWithdraw) {
      return {withdraw, unstakeAndWithdraw}
    } else if (withdraw && !unstakeAndWithdraw) {
      return {withdraw, unstakeAndWithdraw}
    } else if (!withdraw && unstakeAndWithdraw) {
      return {withdraw, unstakeAndWithdraw}
    } else {
      throw new Error("Failed to identify withdraw and/or unstake-and-withdraw transaction info.")
    }
  }

  function action({transactionAmount}) {
    assertNonNullable(stakingRewards)

    const withdrawalAmountString = usdcToAtomic(transactionAmount)
    const withdrawalAmount = new BigNumber(withdrawalAmountString)
    const info = getWithdrawalInfo(withdrawalAmount, stakingRewards)

    return (
      info.withdraw
        ? sendFromUser(
            pool.contract.methods.withdrawInFidu(info.withdraw.fiduAmount.toString(10)),
            {
              type: "Withdraw",
              fiduAmount: fiduFromAtomic(info.withdraw.fiduAmount),
            },
            {
              rejectOnError: true,
            }
          )
        : Promise.resolve()
    ).then(() =>
      info.unstakeAndWithdraw
        ? sendFromUser(
            info.unstakeAndWithdraw.tokens.length === 1
              ? stakingRewards.contract.methods.unstakeAndWithdrawInFidu(
                  info.unstakeAndWithdraw.tokens[0]!.tokenId,
                  info.unstakeAndWithdraw.tokens[0]!.fiduAmount.toString(10)
                )
              : stakingRewards.contract.methods.unstakeAndWithdrawMultipleInFidu(
                  info.unstakeAndWithdraw.tokens.map((info) => info.tokenId),
                  info.unstakeAndWithdraw.tokens.map((info) => info.fiduAmount.toString(10))
                ),
            {
              type: "Unstake and Withdraw",
              tokens: info.unstakeAndWithdraw.tokens.map((info) => info.tokenId),
              fiduAmounts: info.unstakeAndWithdraw.tokens.map((info) => fiduFromAtomic(info.fiduAmount)),
            }
          )
        : Promise.resolve()
    )
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
    // NOTE: The figure we show about how much GFI will be forfeited because it is unvested should
    // be considered an estimate. That's because the actual amount forfeited is determined at the
    // time of executing the unstaking transaction, and the unstaking transaction causes its own
    // checkpointing / updating of rewards info. So the sum of unvested rewards we have computed
    // here, as the basis for telling the user how much unvested rewards their withdrawal entails
    // forfeiting, will not necessarily equal the amount that will actually be forfeited when the
    // transaction is executed.
    const forfeitAdvisory = props.capitalProvider.stakingRewards.hasUnvested ? (
      <div className="form-message paragraph">
        {"You have "}
        {displayNumber(gfiFromAtomic(props.capitalProvider.stakingRewards.unvested), 2)}
        {" GFI ("}
        {displayDollars(props.capitalProvider.stakingRewards.unvestedInDollars, 2)}
        {") that is still vesting until "}
        {lastVestingEnd!.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
        {". If you withdraw before then, you "}
        {props.capitalProvider.shares.parts.notStaked.gt(0) ? "might" : "will"}
        {" forfeit a portion of your unvested GFI."}
      </div>
    ) : undefined
    const protocolFeeAdvisory = (
      <div className="form-message paragraph">
        {forfeitAdvisory ? "Also as a reminder," : "Note that"}
        {" the protocol will deduct a 0.50% fee from your withdrawal amount for protocol reserves."}
      </div>
    )
    let notes: React.ReactNode[] = []
    if (transactionAmount && stakingRewards) {
      const withdrawalAmountString = usdcToAtomic(transactionAmount)
      const withdrawalAmount = new BigNumber(withdrawalAmountString)
      const info = getWithdrawalInfo(withdrawalAmount, stakingRewards)
      const forfeitedGfi = info.unstakeAndWithdraw ? info.unstakeAndWithdraw.forfeitedGfiSum : new BigNumber(0)
      notes = [
        {
          key: "advisory",
          content: (
            <p>
              {"You will "}
              <span className="font-bold">
                {"receive "}
                {displayDollars(usdcFromAtomic(withdrawalAmount.multipliedBy(995).dividedBy(1000)), 2)}
              </span>
              {" net of protocol reserves and "}
              <span className="font-bold">
                {"forfeit "}
                {displayNumber(gfiFromAtomic(forfeitedGfi), 2)}
                {" GFI ("}
                {displayDollars(gfiInDollars(gfiToDollarsAtomic(forfeitedGfi, props.capitalProvider.gfiPrice)), 2)}
                {")"}
              </span>
              {" that is still unvested."}
            </p>
          ),
        },
      ]
    }
    return (
      <div className="form-inputs">
        {forfeitAdvisory}
        {protocolFeeAdvisory}
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            maxAmount={availableToWithdraw}
            onChange={(e) => {
              debouncedSetTransactionAmount(formMethods.getValues("transactionAmount"))
            }}
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
            notes={notes}
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
