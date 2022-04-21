import BigNumber from "bignumber.js"
import {useEffect, useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import useDebounce from "../../hooks/useDebounce"
import {displayNumber} from "../../utils"
import StakingPrompt from "../StakingPrompt"
import TransactionInput from "../transactionInput"

type LPAndStakeCardFormProps = {
  depositToken: ERC20Metadata
  maxAmountToDeposit: BigNumber
  stakingApy: BigNumber
  deposit: (BigNumber) => Promise<any>
  depositAndStake: (BigNumber) => Promise<any>
  estimateSlippage: (BigNumber) => Promise<BigNumber>
}

const Container = styled.div`
  display: flex;
`

const StyledStakingPrompt = styled(StakingPrompt)`
  padding-bottom: 30px;
`

const StyledButton = styled.button<{small: boolean}>`
  font-size: ${({small}) => (small ? "20px" : "inherit")};
`

export default function LPAndStakeCardForm({
  depositToken,
  maxAmountToDeposit,
  stakingApy,
  deposit,
  depositAndStake,
  estimateSlippage,
}: LPAndStakeCardFormProps) {
  const formMethods = useForm()

  const [isPending, setIsPending] = useState(false)
  const [shouldStake, setShouldStake] = useState<boolean>(true)
  const [amountToDeposit, setAmountToDeposit] = useState(0)

  const debouncedSetAmountToDeposit = useDebounce(setAmountToDeposit, 200)

  useEffect(() => {
    estimateSlippage(new BigNumber(amountToDeposit).multipliedBy(new BigNumber(10).pow(depositToken.decimals))).then(
      (slippage) => console.log(slippage.toString(10))
    )
  }, [amountToDeposit])

  function onChange() {
    debouncedSetAmountToDeposit(formMethods.getValues("amountToDeposit"))
  }

  function onStakingPromptToggle(e) {
    setShouldStake(!shouldStake)
  }

  function onMaxClick(maxAmountToDeposit) {
    formMethods.setValue("amountToDeposit", new BigNumber(maxAmountToDeposit || 0).decimalPlaces(18, 1).toString(10), {
      shouldValidate: true,
      shouldDirty: true,
    })
    onChange()
  }

  function onSubmit(e) {
    setIsPending(true)
    if (shouldStake) {
      depositAndStake(new BigNumber(amountToDeposit).multipliedBy(new BigNumber(10).pow(depositToken.decimals))).then(
        () => setIsPending(false)
      )
    } else {
      deposit(new BigNumber(amountToDeposit).multipliedBy(new BigNumber(10).pow(depositToken.decimals))).then(() =>
        setIsPending(false)
      )
    }
  }

  const maxAmount = maxAmountToDeposit?.div(new BigNumber(10).pow(depositToken.decimals))

  const amountInputLabel = maxAmountToDeposit.isZero()
    ? "Amount"
    : `Amount (max: ${displayNumber(maxAmount)} ${depositToken.ticker})`

  const submitButtonText = shouldStake ? "Deposit and stake" : "Deposit"

  return (
    <div>
      <Container></Container>
      <FormProvider {...formMethods}>
        <div>
          <StyledStakingPrompt formVal={depositToken.name} stakingApy={stakingApy} onToggle={onStakingPromptToggle} />
          <div className="form-input-label">{amountInputLabel}</div>
          <div className="form-inputs-footer">
            <TransactionInput
              name="amountToDeposit"
              ticker={depositToken.ticker}
              displayTicker={false}
              formMethods={formMethods}
              maxAmount={maxAmount?.toString(10)}
              onChange={onChange}
              rightDecoration={
                <button
                  className="enter-max-amount"
                  disabled={maxAmountToDeposit.isZero()}
                  type="button"
                  onClick={() => onMaxClick(maxAmount)}
                >
                  Max
                </button>
              }
            />
            <StyledButton
              type="button"
              disabled={!amountToDeposit || isPending}
              className="button submit-form"
              onClick={onSubmit}
              small={shouldStake}
            >
              {submitButtonText}
            </StyledButton>
          </div>
        </div>
      </FormProvider>
    </div>
  )
}
