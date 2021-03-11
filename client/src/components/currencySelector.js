import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Tickers } from '../ethereum/erc20';

function CurrencySelector(props) {
  const { formMethods, onChange } = props;

  return (
    <div className={'currency-selector'}>
      <span>Pay with: </span>
      <select
        name="currency"
        ref={formMethods.register}
        onChange={e => {
          let newValue = formMethods.getValues('currency');
          onChange(newValue);
        }}
      >
        <option value={Tickers.USDC}>{Tickers.USDC}</option>
        <option value={Tickers.USDT}>{Tickers.USDT}</option>
        <option value={Tickers.BUSD}>{Tickers.BUSD}</option>
      </select>
    </div>
  );
}

export default CurrencySelector;
