import React, { useCallback, useEffect } from "react"
import { displayDollars, displayNumber } from "../utils"
import { useAmountTargetingMinAmount } from "../hooks/useOneInchQuote"

function PaymentOptions(props) {
  const { selected, creditLine, onSelect, formMethods } = props
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
    cl => {
      function displayAmounts(amount, swappedAmount) {
        let amountDisplay = <span className="font-bold">{displayDollars(amount)}</span>
        if (!swappedAmount) return amountDisplay
        return (
          <>
            {amountDisplay} (~{displayNumber(swappedAmount, 2)} {props.erc20.ticker})
          </>
        )
      }

      let valueOptions = [
        {
          name: "totalDue",
          label: cl.isMultiple ? (
            <>Pay all balances plus interest: {displayAmounts(cl.remainingTotalDueAmountInDollars, fullDueAmount)}</>
          ) : (
            <>Pay full balance plus interest: {displayAmounts(cl.remainingTotalDueAmountInDollars, fullDueAmount)}</>
          ),
          value: cl.remainingTotalDueAmountInDollars,
          swapValue: fullDueAmount,
        },
        { name: "other", label: "Pay other amount", value: "other" },
      ]
      if (cl.remainingPeriodDueAmount.gt(0)) {
        valueOptions.unshift({
          name: "periodDue",
          label: cl.isMultiple ? (
            <>Pay all minimums due: {displayAmounts(cl.remainingPeriodDueAmountInDollars, minimumDueAmount)}</>
          ) : (
            <>Pay minimum due: {displayAmounts(cl.remainingPeriodDueAmountInDollars, minimumDueAmount)}</>
          ),
          value: cl.remainingPeriodDueAmountInDollars,
          swapValue: minimumDueAmount,
        })
      }
      return valueOptions
    },
    [props.erc20.ticker, fullDueAmount, minimumDueAmount],
  )

  useEffect(() => {
    const options = getValueOptions(creditLine)
    options.forEach(valueOption => {
      if (valueOption.name === selected) {
        formMethods.setValue("paymentOption", valueOption.name, { shouldValidate: true, shouldDirty: true })
        // So the default value is populated in the transaction input
        onSelect(valueOption.name, valueOption.swapValue || valueOption.value)
      }
    })
  }, [getValueOptions, selected, creditLine, onSelect, formMethods])

  function getValueOptionsList() {
    const valueOptions = getValueOptions(props.creditLine, props.selected)
    return valueOptions.map((valueOption, index) => {
      let checked = false
      if (valueOption.name === props.selected) {
        checked = true
      }
      return (
        <div className="value-option" key={index}>
          <input
            name="paymentOption"
            type="radio"
            id={`value-type-${index}`}
            checked={checked}
            ref={props.formMethods.register}
            value={valueOption.value}
            onChange={() => {
              props.onSelect(valueOption.name, valueOption.swapValue || valueOption.value)
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
