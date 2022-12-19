import React from "react"
import {ErrorMessage} from "@hookform/error-message"
import {Controller} from "react-hook-form"
import {displayDollars, displayNumber} from "../utils"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {Ticker} from "../ethereum/erc20"
import NumberFormat from "react-number-format"

type TransactionInputProps = {
  name?: string
  disabled?: boolean
  onChange?: (val: unknown) => void
  inputClass?: string
  ticker?: string
  displayTicker?: boolean
  displayUSDCTicker?: boolean
  notes?: Array<{
    key: string
    content: React.ReactNode
  }>
  formMethods: any
  maxAmount?: string
  validations?: {
    [name: string]: (val: string) => boolean | string
  }
  rightDecoration?: React.ReactNode
  error?: boolean
  warning?: boolean
  className?: string
}

function TransactionInput(props: TransactionInputProps) {
  let name = props.name || "transactionAmount"
  let inputClass = props.inputClass || ""
  if (props.disabled) {
    inputClass = "disabled"
  }
  let propsOnChange = props.onChange || ((val: unknown) => {})
  let validations = props.validations || {}
  let notes = _.compact(props.notes || [])
  let ticker = props.ticker || Ticker.USDC
  let displayTicker = _.isUndefined(props.displayTicker) ? true : props.displayTicker

  let noteEls = notes.map(({key, content}) => (
    <div key={key} className="form-input-note">
      {content}
    </div>
  ))
  let errors = Object.keys(props.formMethods.errors)
  if (errors.length > 0) {
    errors.map((name) => {
      return noteEls.push(
        <div key={`error-${name}`} className="form-input-note">
          <ErrorMessage
            message={(function (errors, name) {
              return errors[name] && errors[name].message
            })(props.formMethods.errors, name)}
            name={name}
          />
        </div>
      )
    })
  }

  let maxAmountErrorMessage
  if (ticker === Ticker.USDC) {
    maxAmountErrorMessage = `Amount is above the max allowed (${displayDollars(props.maxAmount)}). `
  } else {
    maxAmountErrorMessage = `Amount is above the max allowed (${displayNumber(props.maxAmount)} ${ticker}). `
  }

  // Another hacky solution to get the temporary Zapper UI layout correct
  // without affecting the other components that use this
  let className = props.className || "form-field"

  return (
    <div className={className}>
      <div className={`form-input-container ${inputClass}`}>
        <div className={`transaction-input ${!!props.error ? "error" : !!props.warning ? "warning" : ""}`}>
          {ticker === Ticker.USDC && displayTicker && !props.displayUSDCTicker && (
            <div className="ticker before">$</div>
          )}
          <Controller
            control={props.formMethods.control}
            name={name}
            defaultValue=""
            rules={{
              required: "Amount is required",
              min: {value: 0.0000001, message: "Must be greater than 0"},
              max: props.maxAmount
                ? {
                    value: props.maxAmount,
                    message: maxAmountErrorMessage,
                  }
                : undefined,
              validate: {
                decimals: (value) => new BigNumber(value).decimalPlaces()! <= 6 || "Maximum allowed decimal places is 6",
                ...validations,
              },
            }}
            render={({onChange, onBlur, value}) => {
              return (
                <NumberFormat
                  allowNegative={false}
                  thousandSeparator={true}
                  onBlur={onBlur}
                  onValueChange={(v) => {
                    if (v.value !== value) {
                      onChange(v.value)
                      propsOnChange(v.value)
                    }
                  }}
                  value={value}
                  placeholder="0"
                  className="form-input"
                />
              )
            }}
          />
          {(ticker !== Ticker.USDC || !!props.displayUSDCTicker) && displayTicker && (
            <div className="ticker after">{ticker}</div>
          )}
          {props.rightDecoration}
        </div>
        {noteEls}
      </div>
    </div>
  )
}

export default TransactionInput
