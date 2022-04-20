import BigNumber from "bignumber.js"
import {useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import styled from "styled-components"
import {getERC20Metadata, Ticker, toDecimal} from "../../ethereum/erc20"
import useDebounce from "../../hooks/useDebounce"
import {displayNumber} from "../../utils"
import TransactionInput from "../transactionInput"

const FIDU = getERC20Metadata(Ticker.FIDU)
const USDC = getERC20Metadata(Ticker.USDC)

type StakingCardMigrateToCurveFormProps = {
  maxFiduAmountToMigrate: BigNumber
  maxUSDCAmountToDeposit: BigNumber
  migrate: (fiduAmount: BigNumber, usdcAmount: BigNumber) => Promise<any>
}

const InputContainer = styled.div`
  :not(:last-child) {
    padding-bottom: 18px;
  }
`

export default function StakingCardMigrateToCurveForm({
  maxFiduAmountToMigrate,
  maxUSDCAmountToDeposit,
  migrate,
}: StakingCardMigrateToCurveFormProps) {
  const formMethods = useForm()

  const [fiduAmountToMigrate, setFiduAmountToMigrate] = useState(0)
  const [usdcAmountToDeposit, setUsdcAmountToDeposit] = useState(0)

  const debouncedSetFiduAmountToMigrate = useDebounce(setFiduAmountToMigrate, 200)
  const debouncedSetUsdcAmountToDeposit = useDebounce(setUsdcAmountToDeposit, 200)

  function onChange(ticker: Ticker.FIDU | Ticker.USDC) {
    console.log("here")
  }

  function onMaxClick(ticker: Ticker.FIDU | Ticker.USDC) {
    const maxAmount = ticker === Ticker.FIDU ? maxFiduAmountToMigrate : maxUSDCAmountToDeposit
    formMethods.setValue(
      getFormInputName(ticker),
      toDecimal(new BigNumber(maxAmount || 0), ticker)
        .decimalPlaces(18, 1)
        .toString(10),
      {
        shouldValidate: true,
        shouldDirty: true,
      }
    )
    onChange(ticker)
  }

  function getFormInputName(ticker: Ticker.FIDU | Ticker.USDC): string {
    return ticker === Ticker.FIDU ? "fiduAmountToMigrate" : "usdcAmountAmountToDeposit"
  }

  function onSubmit(e) {
    console.log("submit")
  }

  return (
    <FormProvider {...formMethods}>
      <div>
        <InputContainer>
          <div className="form-input-label">{`Amount (max: ${displayNumber(
            toDecimal(maxFiduAmountToMigrate, Ticker.FIDU)
          )}) ${FIDU.ticker}`}</div>
          <div className="form-inputs-footer">
            <TransactionInput
              name={getFormInputName(Ticker.FIDU)}
              ticker={FIDU.ticker}
              displayTicker={false}
              formMethods={formMethods}
              maxAmount={toDecimal(maxFiduAmountToMigrate, Ticker.FIDU).toString(10)}
              onChange={() => onChange(Ticker.FIDU)}
              rightDecoration={
                <button
                  className="enter-max-amount"
                  disabled={maxFiduAmountToMigrate.isZero()}
                  type="button"
                  onClick={() => onMaxClick(Ticker.FIDU)}
                >
                  Max
                </button>
              }
            />
          </div>
        </InputContainer>
        <InputContainer>
          <div className="form-input-label">{`Amount (max: ${displayNumber(
            toDecimal(maxUSDCAmountToDeposit, Ticker.USDC)
          )}) ${USDC.ticker}`}</div>
          <div className="form-inputs-footer">
            <TransactionInput
              name={getFormInputName(Ticker.USDC)}
              ticker={USDC.ticker}
              displayTicker={false}
              formMethods={formMethods}
              maxAmount={toDecimal(maxUSDCAmountToDeposit, Ticker.USDC).toString(10)}
              onChange={() => onChange(Ticker.USDC)}
              rightDecoration={
                <button
                  className="enter-max-amount"
                  disabled={maxUSDCAmountToDeposit.isZero()}
                  type="button"
                  onClick={() => onMaxClick(Ticker.USDC)}
                >
                  Max
                </button>
              }
            />

            <button type="button" disabled={false} className="button submit-form" onClick={onSubmit}>
              Migrate
            </button>
          </div>
        </InputContainer>
      </div>
    </FormProvider>
  )
}
