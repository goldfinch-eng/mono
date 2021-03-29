import React, { useState } from "react"
import { Tickers } from "../ethereum/erc20"
import Dropdown from "./dropdown"

function CurrencyDropdown(props) {
  const { onChange, className = "", selectedClassName = "" } = props

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
      onSelect={val => {
        setSelected(val)
        onChange(val)
      }}
    />
  )
}

export default CurrencyDropdown
