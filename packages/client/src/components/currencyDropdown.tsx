import React, {useState} from "react"
import {Tickers} from "../ethereum/erc20"
import Dropdown from "./dropdown"

interface CurrencyDropdownProps {
  onChange: (val: any) => any
  className?: string
  selectedClassName?: string
}

/**
 * A component to display currencies available for use
 * @param props
 * @param props.onChange callback used when the selected currency changes
 * @param props.className classname to apply to dropdown
 * @param props.selectedClassName classname to apply to selected element
 * @returns component
 */
export default function CurrencyDropdown({
  onChange,
  className = "",
  selectedClassName = "",
}: CurrencyDropdownProps): JSX.Element {
  const options = [
    {
      value: Tickers.USDC,
      el: <span>{Tickers.USDC}</span>,
    },
    {
      value: Tickers.USDT,
      el: <span>{Tickers.USDT}</span>,
    },
    {
      value: Tickers.BUSD,
      el: <span>{Tickers.BUSD}</span>,
    },
  ]
  const [selected, setSelected] = useState(Tickers.USDC)

  return (
    <Dropdown
      className={`currency-dropdown ${className}`}
      selectedClassName={selectedClassName}
      selected={selected}
      options={options}
      onSelect={(val) => {
        setSelected(val)
        onChange(val)
      }}
    />
  )
}
