import React from "react"
import {ErrorMessage} from "@hookform/error-message"
import {Controller} from "react-hook-form"
import {displayDollars} from "../utils"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {Tickers} from "../ethereum/erc20"
import NumberFormat from "react-number-format"

type TransactionInputProps = {
  name?: string
  disabled?: boolean
  onChange?: (val: unknown) => void
  inputClass?: string
  ticker?: string
  notes?: Array<{
    key: string
    content: React.ReactNode
  }>
  formMethods: any
  maxAmountInDollars?: string
  validations?: {
    [name: string]: (val: string) => boolean | string
  }
  rightDecoration?: React.ReactNode
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
  let ticker = props.ticker || Tickers.USDC

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

  return (
    <div className="form-field">
      <div className={`form-input-container ${inputClass}`}>
        <div className="transaction-input">
          {ticker === Tickers.USDC && <div className="ticker before">$</div>}
          <Controller
            control={props.formMethods.control}
            name={name}
            defaultValue=""
            rules={{
              required: "Amount is required",
              min: {value: 0.0000001, message: "Must be greater than 0"},
              max: props.maxAmountInDollars
                ? {
                    value: props.maxAmountInDollars,
                    message: `Amount is above the max allowed (${displayDollars(props.maxAmountInDollars)}). `,
                  }
                : undefined,
              validate: {
                decimals: (value) => new BigNumber(value).decimalPlaces() <= 6 || "Maximum allowed decimal places is 6",
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
          {ticker !== Tickers.USDC && <div className="ticker after">{ticker}</div>}
          {props.rightDecoration}
        </div>
        {noteEls}
      </div>
    </div>
  )
}

export default TransactionInput
