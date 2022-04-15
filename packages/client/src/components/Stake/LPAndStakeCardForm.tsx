import BigNumber from "bignumber.js"
import {useState} from "react"
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
}

const Container = styled.div`
  display: flex;
`

const StyledStakingPrompt = styled(StakingPrompt)`
  padding-bottom: 30px;
`

export default function LPAndStakeCardForm({
  depositToken,
  maxAmountToDeposit,
  stakingApy,
  deposit,
  depositAndStake,
}: LPAndStakeCardFormProps) {
  const formMethods = useForm()

  const [shouldStake, setShouldStake] = useState<boolean>(true)
  const [amountToDeposit, setAmountToDeposit] = useState(0)

  const debouncedSetAmountToDeposit = useDebounce(setAmountToDeposit, 200)

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
    if (shouldStake) {
      depositAndStake(amountToDeposit)
    } else {
      deposit(amountToDeposit)
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
          <StyledStakingPrompt stakingApy={stakingApy} onToggle={onStakingPromptToggle} />
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
            <button type="button" disabled={!amountToDeposit} className="button submit-form" onClick={onSubmit}>
              {submitButtonText}
            </button>
          </div>
        </div>
      </FormProvider>
    </div>
  )
}
