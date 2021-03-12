import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Tickers } from '../ethereum/erc20';
import Dropdown from './dropdown';

function CurrencySelector(props) {
  const { onChange } = props;

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
  ];
  const [selected, setSelected] = useState(Tickers.USDC);

  return (
    <div className={'currency-selector'}>
      <span>Pay with: </span>
      <Dropdown
        selected={selected}
        options={options}
        onSelect={val => {
          setSelected(val);
          onChange(val);
        }}
      />
    </div>
  );
}

export default CurrencySelector;
