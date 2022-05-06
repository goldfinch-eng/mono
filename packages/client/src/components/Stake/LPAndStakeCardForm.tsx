import BigNumber from "bignumber.js"
import {useEffect, useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import styled from "styled-components"
import {ERC20Metadata, toAtomicAmount} from "../../ethereum/erc20"
import {Slippage} from "../../hooks/useCurvePool"
import useDebounce from "../../hooks/useDebounce"
import {displayNumber, displayPercent} from "../../utils"
import StakingPrompt from "../StakingPrompt"
import TransactionInput from "../transactionInput"
import {tickerToPositionType} from "./utils"

type LPAndStakeCardFormProps = {
  // Token to deposit
  depositToken: ERC20Metadata
  // LP token received in exchange
  poolToken: ERC20Metadata
  // Max amount available to deposit (denominated in depositToken decimals)
  maxAmountToDeposit: BigNumber
  // Staking reward APY
  stakingApy: BigNumber
  deposit: (BigNumber) => Promise<any>
  depositAndStake: (BigNumber) => Promise<any>
  estimateSlippage: (BigNumber) => Promise<Slippage>
}

const StyledStakingPrompt = styled(StakingPrompt)`
  padding-bottom: 30px;
`

const StyledButton = styled.button<{small: boolean}>`
  font-size: ${({small}) => (small ? "20px" : "inherit")};
`

const Message = styled.div`
  font-size: ${({theme}) => theme.typography.fontSize.sansSizeS};
  font-weight: normal;
  text-align: center;
  padding: 24px;
  border-radius: 6px;
  margin-top: 30px;
`

const MessageError = styled(Message)`
  background-color: ${({theme}) => theme.colors.redXLight};
`

const MessageWarning = styled(Message)`
  background-color: ${({theme}) => theme.colors.yellow};
`

export default function LPAndStakeCardForm({
  depositToken,
  maxAmountToDeposit,
  stakingApy,
  poolToken,
  deposit,
  depositAndStake,
  estimateSlippage,
}: LPAndStakeCardFormProps) {
  const formMethods = useForm()

  const [isPending, setIsPending] = useState(false)
  const [shouldStake, setShouldStake] = useState<boolean>(true)
  const [amountToDepositInDecimals, setAmountToDepositInDecimals] = useState<BigNumber>(new BigNumber(0))
  const [estimatedSlippage, setEstimatedSlippage] = useState<Slippage>({slippage: new BigNumber(0), error: false})
  const [shouldUseMaxAmount, setShouldUseMaxAmount] = useState(false)

  const debouncedSetAmountToDepositInDecimals = useDebounce(setAmountToDepositInDecimals, 200)

  useEffect(() => {
    estimateSlippage(toAtomicAmount(amountToDepositInDecimals, depositToken.decimals)).then((slippage) =>
      setEstimatedSlippage(slippage)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountToDepositInDecimals])

  function onChange({isMaxClick = false}: {isMaxClick?: boolean}) {
    const amountToDeposit: string = formMethods.getValues("amountToDeposit")
    debouncedSetAmountToDepositInDecimals(!!amountToDeposit ? new BigNumber(amountToDeposit) : new BigNumber(0))
    setShouldUseMaxAmount(isMaxClick)
  }

  function onStakingPromptToggle(e) {
    setShouldStake(!shouldStake)
  }

  function onMaxClick(maxAmount: BigNumber) {
    formMethods.setValue("amountToDeposit", maxAmount.decimalPlaces(6, 1).toString(10), {
      shouldValidate: true,
      shouldDirty: true,
    })
    onChange({isMaxClick: true})
  }

  function onSubmit(e) {
    setIsPending(true)

    // If the most recent value was set using the "Max" button, use the precise value of `maxAmountToDeposit`,
    // instead of the imprecise `amountToDepositInDecimals` to avoid any "dust" left behind.
    const atomicAmountToSubmit = shouldUseMaxAmount
      ? maxAmountToDeposit
      : toAtomicAmount(amountToDepositInDecimals, depositToken.decimals)

    if (shouldStake) {
      depositAndStake(atomicAmountToSubmit).then(onSubmitComplete)
    } else {
      deposit(atomicAmountToSubmit).then(onSubmitComplete)
    }
  }

  function onSubmitComplete() {
    setIsPending(false)

    // Clear form fields
    formMethods.reset()
    setAmountToDepositInDecimals(new BigNumber(0))
  }

  const maxAmountInDecimals = maxAmountToDeposit.div(new BigNumber(10).pow(depositToken.decimals))
  const amountInputLabel = maxAmountToDeposit.isZero()
    ? "Amount"
    : `Amount (max: ${displayNumber(maxAmountInDecimals)} ${depositToken.ticker})`
  const hasSufficientBalance = maxAmountToDeposit.gte(toAtomicAmount(amountToDepositInDecimals, depositToken.decimals))
  const submitButtonText = hasSufficientBalance
    ? shouldStake
      ? "Deposit and stake"
      : "Deposit"
    : "Insufficient balance"

  // Based off of Curve's slippage thresholds
  // https://github.com/curvefi/crv.finance/blob/main/src/components/slippageInfo/slippageInfo.jsx#L21-L22
  const isHighSlippage = estimatedSlippage.slippage.isLessThan(new BigNumber(-0.5))
  const isVeryHighSlippage = estimatedSlippage.slippage.isLessThan(new BigNumber(-10))

  const slippageError = estimatedSlippage.error
  const priceImpactToDisplay = displayPercent(
    (estimatedSlippage.slippage.isNegative()
      ? estimatedSlippage.slippage.times(new BigNumber(-1))
      : estimatedSlippage.slippage
    ).div(new BigNumber(100))
  )

  return (
    <div>
      <FormProvider {...formMethods}>
        <div>
          <StyledStakingPrompt
            formVal={depositToken.name}
            stakedPositionType={tickerToPositionType(poolToken.ticker)}
            stakingApy={stakingApy}
            onToggle={onStakingPromptToggle}
          />
          <div className="form-input-label">{amountInputLabel}</div>
          <div className="form-inputs-footer">
            <TransactionInput
              name="amountToDeposit"
              ticker={depositToken.ticker}
              displayTicker={true}
              displayUSDCTicker={true}
              formMethods={formMethods}
              maxAmount={maxAmountInDecimals.toString(10)}
              onChange={() => onChange({isMaxClick: false})}
              error={isVeryHighSlippage || slippageError}
              warning={isHighSlippage}
              rightDecoration={
                <button
                  className="enter-max-amount"
                  disabled={maxAmountToDeposit.isZero()}
                  type="button"
                  onClick={() => onMaxClick(maxAmountInDecimals)}
                >
                  Max
                </button>
              }
            />
            <StyledButton
              type="button"
              disabled={
                amountToDepositInDecimals.isZero() ||
                isPending ||
                isVeryHighSlippage ||
                slippageError ||
                !hasSufficientBalance
              }
              className="button submit-form"
              onClick={onSubmit}
              small={shouldStake || !hasSufficientBalance}
            >
              {submitButtonText}
            </StyledButton>
          </div>
          {/* The Curve contract function call to calculate slippage will fail with very large deposit values. 
              If we got a error from Curve, display the error message without the price impact. */}
          {slippageError && (
            <MessageError>{"Price impact is too high. Reduce the amount you're depositing."}</MessageError>
          )}
          {isVeryHighSlippage && !slippageError && (
            <MessageError>{`Price impact is too high: ${priceImpactToDisplay}. Reduce the amount you're depositing.`}</MessageError>
          )}
          {!isVeryHighSlippage && !slippageError && isHighSlippage && (
            <MessageWarning>{`High price impact: ${priceImpactToDisplay}. Consider reducing the amount you're depositing.`}</MessageWarning>
          )}
        </div>
      </FormProvider>
    </div>
  )
}
