import BigNumber from "bignumber.js"
import React, {useState} from "react"
import {AppContext} from "../../App"
import {
  getNumSharesFromUsdc,
  getUsdcFromNumShares,
  minimumNumber,
  usdcFromAtomic,
  usdcToAtomic,
} from "../../ethereum/erc20"
import {fiduFromAtomic} from "../../ethereum/fidu"
import {CapitalProvider, SeniorPoolData, StakingRewardsPosition} from "../../ethereum/pool"
import useDebounce from "../../hooks/useDebounce"
import useNonNullContext from "../../hooks/useNonNullContext"
import useSendFromUser from "../../hooks/useSendFromUser"
import {
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
} from "../../types/transactions"
import {assertNonNullable, roundDownPenny} from "../../utils"
import LoadingButton from "../loadingButton"
import TransactionInput from "../transactionInput"
import ForfeitAdvisory from "./ForfeitAdvisory"
import ForfeitGfiNotes from "./ForfeitGfiNotes"

export class WithdrawalInfoError extends Error {}
export class ExcessiveWithdrawalError extends Error {}

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
  recognizableUsdcAmount: BigNumber
}
type UnstakeAndWithdrawInfo = UnstakeTokensAccumulator & {
  recognizableUsdcAmount: BigNumber
}

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

type TransactionConfig = {
  displayAmount: string
  // Whether the user intends to withdraw the maximum amount. If this is `true`, we should compute the
  // withdrawal amount respecting this value instead of `displayAmount`, as using the
  // latter would be liable to leave "dust" because it is a USDC amount and therefore may convert
  // imprecisely into FIDU.
  max: boolean
}

interface FormProps {
  formMethods: any
  capitalProvider: CapitalProvider
  poolData: SeniorPoolData
}

export default function Form(props: FormProps) {
  const {goldfinchConfig} = useNonNullContext(AppContext)
  const {pool, stakingRewards} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()
  const [transactionConfig, setTransactionConfig] = useState<TransactionConfig | undefined>()
  const debouncedSetTransactionConfig = useDebounce(setTransactionConfig, 200)

  function handleMaxButtonClick() {
    const displayAmount = roundDownPenny(availableToWithdrawInDollars).toString(10)
    const newConfig: TransactionConfig =
      // Use `max: true` in the new config if and only if we're not limiting the withdrawable
      // amount by some applicable limit (e.g. such as `goldfinchConfig.transactionLimit`).
      availableToWithdrawInDollars === props.capitalProvider?.availableToWithdrawInDollars.toString(10)
        ? {
            displayAmount,
            max: true,
          }
        : {
            displayAmount,
            max: false,
          }
    setTransactionConfig(newConfig)
    props.formMethods.setValue("transactionAmount", displayAmount, {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  function getWithdrawalInfo(config: TransactionConfig): WithdrawalInfo {
    const withdrawalUsdcDisplayAmount = new BigNumber(usdcToAtomic(config.displayAmount))

    // We prefer to perform withdrawals in FIDU, rather than USDC, as this ensures we can withdraw
    // unstaked FIDU completely and exit staked positions completely (assuming the share price does
    // not change between the time we perform this computation and the time the transaction executes).
    // If we performed the withdrawal in terms of USDC, it would be possible, due to rounding error
    // in the conversion from USDC -> FIDU, for unstaked FIDU not to be withdrawn completely or for
    // staked positions not to be exited completely.
    const withdrawalFiduAmount: BigNumber = config.max
      ? props.capitalProvider.shares.aggregates.withdrawable
      : getNumSharesFromUsdc(withdrawalUsdcDisplayAmount, props.capitalProvider.sharePrice)

    if (!withdrawalFiduAmount.gt(0)) {
      throw new WithdrawalInfoError("Withdrawal amount in FIDU must be greater than 0.")
    }

    if (withdrawalFiduAmount.gt(props.capitalProvider.shares.aggregates.withdrawable)) {
      throw new ExcessiveWithdrawalError(
        `Tried to withdraw more shares (${withdrawalFiduAmount.toString(
          10
        )}) than are withdrawable (${props.capitalProvider.shares.aggregates.withdrawable.toString(10)}).`
      )
    }
    let withdrawalFiduAmountRemaining = withdrawalFiduAmount

    // If user holds any unstaked FIDU, withdraw that first. Prioritizing unstaked FIDU in this
    // way is intended to be user-friendly, because unstaked FIDU is not earning rewards.
    let withdraw: Omit<WithdrawInfo, "recognizableUsdcAmount"> | undefined
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
    let unstakeAndWithdraw: Omit<UnstakeAndWithdrawInfo, "recognizableUsdcAmount"> | undefined
    if (withdrawalFiduAmountRemaining.gt(0)) {
      const positions = props.capitalProvider.unstakeablePositions
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
            // Zero FIDU remaining on the position is possible via having fully unstaked.
            if (fiduPortion.eq(0)) {
              if (!curr.unvested.eq(0)) {
                console.error("Expected zero unvested rewards if FIDU amount on position is 0.")
              }
              return acc
            } else {
              const forfeitedGfiPortion = curr.unvested
                .multipliedBy(fiduPortion)
                .dividedToIntegerBy(curr.storedPosition.amount)
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

      unstakeAndWithdraw = reduced

      withdrawalFiduAmountRemaining = withdrawalFiduAmountRemaining.minus(reduced.fiduSum)
    }

    if (!withdrawalFiduAmountRemaining.eq(0)) {
      throw new WithdrawalInfoError("Failed to prepare withdrawals of desired FIDU amount.")
    }

    // We perform the withdrawal transactions in FIDU, but want to be able to describe the
    // transaction (e.g. in the recent transactions shown in the network widget) in USDC
    // amounts that are recognizable to the user, i.e. that accord with the USDC amount
    // they entered into the form. So here we define the "recognizable" USDC amount corresponding
    // to the withdraw transaction and the unstake-and-withdraw transaction, ensuring that
    // they sum to the `withdrawalUsdcDisplayAmount` (which corresponds to what the user sees in the
    // transaction input), which would not otherwise be guaranteed, because converting from
    // USDC -> FIDU -> USDC could lose precision due to integer division. Note also that in
    // defining these recognizable amounts, we don't reflect the fee taken by the protocol;
    // that deduction will be reflected only in displaying the transactions in their "historical"
    // form.
    if (withdraw && unstakeAndWithdraw) {
      const recognizableUsdcAmountWithdraw = getUsdcFromNumShares(withdraw.fiduAmount, props.capitalProvider.sharePrice)
      return {
        withdraw: {
          ...withdraw,
          recognizableUsdcAmount: recognizableUsdcAmountWithdraw,
        },
        unstakeAndWithdraw: {
          ...unstakeAndWithdraw,
          recognizableUsdcAmount: withdrawalUsdcDisplayAmount.minus(recognizableUsdcAmountWithdraw),
        },
      }
    } else if (withdraw && !unstakeAndWithdraw) {
      return {
        withdraw: {
          ...withdraw,
          recognizableUsdcAmount: withdrawalUsdcDisplayAmount,
        },
        unstakeAndWithdraw,
      }
    } else if (!withdraw && unstakeAndWithdraw) {
      return {
        withdraw,
        unstakeAndWithdraw: {
          ...unstakeAndWithdraw,
          recognizableUsdcAmount: withdrawalUsdcDisplayAmount,
        },
      }
    } else {
      throw new Error("Failed to identify withdraw and/or unstake-and-withdraw transaction info.")
    }
  }

  function action({transactionAmount}) {
    if (!transactionConfig) {
      console.error("Expected withdrawal transaction config to be defined.")
      return
    }
    if (transactionAmount !== transactionConfig.displayAmount) {
      // This case is theoretically possible because the transaction amount maintained in form state is not
      // updated atomically with the updating of the transaction config.
      console.error("Withdrawal transaction config amount is inconsistent with displayed amount.")
      return
    }

    assertNonNullable(stakingRewards)

    const info = getWithdrawalInfo(transactionConfig)

    return (
      info.withdraw
        ? sendFromUser(
            pool.contract.userWallet.methods.withdrawInFidu(info.withdraw.fiduAmount.toString(10)),
            {
              type: WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
              data: {
                recognizableUsdcAmount: usdcFromAtomic(info.withdraw.recognizableUsdcAmount),
                fiduAmount: fiduFromAtomic(info.withdraw.fiduAmount),
              },
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
              ? stakingRewards.contract.userWallet.methods.unstakeAndWithdrawInFidu(
                  info.unstakeAndWithdraw.tokens[0]!.tokenId,
                  info.unstakeAndWithdraw.tokens[0]!.fiduAmount.toString(10)
                )
              : stakingRewards.contract.userWallet.methods.unstakeAndWithdrawMultipleInFidu(
                  info.unstakeAndWithdraw.tokens.map((info) => info.tokenId),
                  info.unstakeAndWithdraw.tokens.map((info) => info.fiduAmount.toString(10))
                ),
            {
              type: UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
              data: {
                recognizableUsdcAmount: usdcFromAtomic(info.unstakeAndWithdraw.recognizableUsdcAmount),
                fiduAmount: fiduFromAtomic(info.unstakeAndWithdraw.fiduSum),
                tokens: info.unstakeAndWithdraw.tokens.map((info) => ({
                  id: info.tokenId,
                  fiduAmount: fiduFromAtomic(info.fiduAmount),
                })),
              },
            }
          )
        : Promise.resolve()
    )
  }

  const availableToWithdrawInDollars = minimumNumber(
    props.capitalProvider?.availableToWithdrawInDollars,
    usdcFromAtomic(props.poolData.balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit)
  )

  // NOTE: The figure we show about how much GFI will be forfeited because it is unvested should
  // be considered an estimate. That's because the actual amount forfeited is determined at the
  // time of executing the unstaking transaction, and the unstaking transaction causes its own
  // checkpointing / updating of rewards info. So the sum of unvested rewards we have computed
  // here, as the basis for telling the user how much unvested rewards their withdrawal entails
  // forfeiting, will not necessarily equal the amount that will actually be forfeited when the
  // transaction is executed.
  const forfeitAdvisory = props.capitalProvider.rewardsInfo.hasUnvested ? (
    <ForfeitAdvisory capitalProvider={props.capitalProvider} />
  ) : undefined

  const protocolFeeAdvisory = (
    <div className="form-message paragraph">
      {forfeitAdvisory ? "Also as a reminder," : "Note that"}
      {" the protocol will deduct a 0.50% fee from your withdrawal amount for protocol reserves."}
    </div>
  )

  const seniorPoolBalance = usdcFromAtomic(props.poolData.balance)
  const amountBeingWithdrawn = props.formMethods.getValues("transactionAmount") || "0"
  const seniorPoolHasSufficientLiquidity = new BigNumber(seniorPoolBalance).gte(amountBeingWithdrawn)
  const insufficientLiquidityAdisory = seniorPoolHasSufficientLiquidity ? undefined : (
    <div data-testid="liquidity-advisory" className="form-message paragraph font-bold">
      {`This amount is above the total $${seniorPoolBalance.toString()} USDC
      available for withdrawals from the Senior Pool. Utilize `}
      <a href="https://curve.fi/factory-crypto/23" target="_blank" rel="noreferrer">
        {"the FIDU<>USDC Curve pool"}
      </a>
      {` instead, or wait for more USDC to enter the Senior Pool via
      Borrower repayments or new Liquidity Providers. Learn more in `}
      <a
        target="_blank"
        href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/liquidityproviders"
        rel="noreferrer"
      >
        the documentation
      </a>
    </div>
  )

  let notes: Array<{key: string; content: React.ReactNode}> = []
  let withdrawalInfo: WithdrawalInfo | undefined
  if (transactionConfig) {
    const withdrawalUsdcDisplayAmount = new BigNumber(usdcToAtomic(transactionConfig.displayAmount))
    if (withdrawalUsdcDisplayAmount.gt(0)) {
      try {
        withdrawalInfo = getWithdrawalInfo(transactionConfig)
      } catch (err: unknown) {
        if (err instanceof ExcessiveWithdrawalError) {
          // It's possible for this case to arise due to the asynchronicity between when the form is
          // reset after a successful withdrawal and when the `capitalProvider` data (which
          // specify how many FIDU are withdrawable) are refreshed. That is, it's transiently possible
          // for the transaction amount (in FIDU) from the successful withdrawal to exceed the number
          // of withdrawable shares, if the `capitalProvider` data managed to be refreshed before
          // the form was reset. So we catch this error and ignore it, as we expect it to be transient.
        } else {
          throw err
        }
      }
      const forfeitedGfi =
        withdrawalInfo && withdrawalInfo.unstakeAndWithdraw
          ? withdrawalInfo.unstakeAndWithdraw.forfeitedGfiSum
          : new BigNumber(0)
      notes = [
        {
          key: "advisory",
          content: (
            <ForfeitGfiNotes
              withdrawalUsdcDisplayAmount={withdrawalUsdcDisplayAmount}
              forfeitedGfi={forfeitedGfi}
              capitalProvider={props.capitalProvider}
            />
          ),
        },
      ]
    }
  }

  return (
    <div className="form-inputs">
      {forfeitAdvisory}
      {protocolFeeAdvisory}
      {insufficientLiquidityAdisory}
      <div className="form-inputs-footer">
        <TransactionInput
          formMethods={props.formMethods}
          onChange={(e) => {
            debouncedSetTransactionConfig({
              displayAmount: props.formMethods.getValues("transactionAmount"),
              max: false,
            })
          }}
          maxAmount={availableToWithdrawInDollars}
          rightDecoration={
            <button className="enter-max-amount" type="button" onClick={handleMaxButtonClick}>
              Max
            </button>
          }
          notes={notes}
        />
        <LoadingButton
          disabled={!withdrawalInfo || !seniorPoolHasSufficientLiquidity}
          action={async (data): Promise<void> => {
            await action(data)
            props.formMethods.reset()
            debouncedSetTransactionConfig()
          }}
        />
      </div>
    </div>
  )
}
