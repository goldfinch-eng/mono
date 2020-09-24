import React from 'react';
import { fromAtomic } from '../ethereum/erc20.js';
import { decimals } from '../ethereum/utils';
import { displayNumber } from '../utils';

function CreditTerms(props) {
  function fromAtomicDecimals(val) {
    return fromAtomic(val) * decimals;
  }

  let rows;
  let cssClass = '';
  if (!props.creditLine.balance) {
    cssClass = 'empty';
    rows = [
      { label: 'Limit', value: '$ -' },
      { label: 'Interest rate APR', value: '- %' },
      { label: 'Payment frequency', value: '-' },
      { label: 'Payback term', value: '-' },
      { label: 'Required collateral', value: '- %' },
    ];
  } else {
    rows = [
      { label: 'Limit', value: '$' + displayNumber(fromAtomic(props.creditLine.limit), 2) },
      {
        label: 'Interest rate APR',
        value: displayNumber(fromAtomic(props.creditLine.interestAprDecimal) * 100, 2) + '%',
      },
      { label: 'Payment frequency', value: fromAtomicDecimals(props.creditLine.paymentPeriodInDays) + ' days' },
      { label: 'Payback term', value: fromAtomicDecimals(props.creditLine.termInDays) + ' days' },
      {
        label: 'Required collateral',
        value: displayNumber(fromAtomicDecimals(props.creditLine.minCollateralPercent), 2) + '%',
      },
    ];
  }

  function convertRowToItem(row, index) {
    return (
      <div className="small-info-item" key={index}>
        <div className="value">{row.value}</div>
        <div className="label">{row.label}</div>
      </div>
    );
  }

  return (
    <div className={`info-section ${cssClass}`}>
      <h2>Credit Terms</h2>
      <div className="info-container small-items">{rows.map(convertRowToItem)}</div>
    </div>
  );
}

export default CreditTerms;
