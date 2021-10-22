import React, {useCallback, useEffect} from "react"
import {displayDollars, displayNumber} from "../utils"
import {useAmountTargetingMinAmount} from "../hooks/useOneInchQuote"

function displayAmounts(amount, swappedAmount, ticker) {
  let amountDisplay = <span className="font-bold">{displayDollars(amount)}</span>
  if (!swappedAmount) return amountDisplay
  return (
    <>
      {amountDisplay} (~{displayNumber(swappedAmount, 2)} {ticker})
    </>
  )
}

function PaymentOptions(props) {
  const {selected, creditLine, onSelect, formMethods} = props
  const [minimumDueAmount] = useAmountTargetingMinAmount({
    from: props.erc20,
    to: props.usdc,
    targetMinAmount: props.creditLine.remainingPeriodDueAmountInDollars,
  })
  const [fullDueAmount] = useAmountTargetingMinAmount({
    from: props.erc20,
    to: props.usdc,
    targetMinAmount: props.creditLine.remainingTotalDueAmountInDollars,
  })

  const getValueOptions = useCallback(
    (cl) => {
      let valueOptions = [
        {
          name: "totalDue",
          label: cl.isMultiple ? (
            <>
              Pay all balances plus interest:{" "}
              {displayAmounts(cl.remainingTotalDueAmountInDollars, fullDueAmount, props.erc20.ticker)}
            </>
          ) : (
            <>
              Pay full balance plus interest:{" "}
              {displayAmounts(cl.remainingTotalDueAmountInDollars, fullDueAmount, props.erc20.ticker)}
            </>
          ),
          value: cl.remainingTotalDueAmountInDollars,
          swapValue: fullDueAmount,
        },
        {name: "other", label: "Pay other amount", value: "other"},
      ]
      if (cl.remainingPeriodDueAmount.gt(0)) {
        valueOptions.unshift({
          name: "periodDue",
          label: cl.isMultiple ? (
            <>
              Pay all minimums due:{" "}
              {displayAmounts(cl.remainingPeriodDueAmountInDollars, minimumDueAmount, props.erc20.ticker)}
            </>
          ) : (
            <>
              Pay minimum due:{" "}
              {displayAmounts(cl.remainingPeriodDueAmountInDollars, minimumDueAmount, props.erc20.ticker)}
            </>
          ),
          value: cl.remainingPeriodDueAmountInDollars,
          swapValue: minimumDueAmount,
        })
      }
      return valueOptions
    },
    [props.erc20.ticker, fullDueAmount, minimumDueAmount]
  )

  useEffect(() => {
    const options = getValueOptions(creditLine)
    options.forEach((valueOption) => {
      if (valueOption.name === selected) {
        formMethods.setValue("paymentOption", valueOption.name, {shouldValidate: true, shouldDirty: true})
        // So the default value is populated in the transaction input
        onSelect(valueOption.name, valueOption.swapValue || valueOption.value)
      }
    })
  }, [getValueOptions, selected, creditLine, onSelect, formMethods])

  function getValueOptionsList() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1 arguments, but got 2.
    const valueOptions = getValueOptions(creditLine, selected)
    return valueOptions.map((valueOption, index) => {
      return (
        <div className="value-option" key={index}>
          <input
            name="paymentOption"
            type="radio"
            id={`value-type-${index}`}
            checked={valueOption.name === selected}
            ref={formMethods.register}
            value={valueOption.name}
            onChange={() => {
              onSelect(valueOption.name, valueOption.swapValue || valueOption.value)
            }}
          />
          <div className="radio-check"></div>
          <label htmlFor={`value-type-${index}`}>{valueOption.label}</label>
        </div>
      )
    })
  }

  const valueOptionList = getValueOptionsList()
  return <div className="value-options">{valueOptionList}</div>
}

export default PaymentOptions
