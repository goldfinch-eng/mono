import React, {useState} from "react"
import {Ticker} from "../ethereum/erc20"
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
      value: Ticker.USDC,
      el: <span>{Ticker.USDC}</span>,
    },
    {
      value: Ticker.USDT,
      el: <span>{Ticker.USDT}</span>,
    },
    {
      value: Ticker.BUSD,
      el: <span>{Ticker.BUSD}</span>,
    },
  ]
  const [selected, setSelected] = useState(Ticker.USDC)

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
