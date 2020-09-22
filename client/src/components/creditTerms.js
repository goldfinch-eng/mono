import React from 'react';
import { fromAtomic } from '../ethereum/erc20.js';
import { decimals } from '../ethereum/utils';

function CreditTerms(props) {
  if (!props.creditLine.balance) {
    return '';
  }

  function fromAtomicDecimals(val) {
    return fromAtomic(val) * decimals;
  }

  const rows = [
    { label: `Limit`, value: '$' + fromAtomic(props.creditLine.limit) },
    { label: 'Interest rate APR', value: fromAtomic(props.creditLine.interestAprDecimal) * 100 + '%' },
    { label: 'Payment frequency', value: fromAtomicDecimals(props.creditLine.paymentPeriodInDays) + ' days' },
    { label: `Payback term`, value: fromAtomicDecimals(props.creditLine.termInDays) + ' days' },
    { label: 'Required collateral', value: fromAtomicDecimals(props.creditLine.minCollateralPercent) + '%' },
  ];

  function convertRowToItem(row, index) {
    return (
      <div className="small-info-item" key={index}>
        <div className="value">{row.value}</div>
        <div className="label">{row.label}</div>
      </div>
    );
  }

  return (
    <div className="info-section">
      <h2>Credit Terms</h2>
      <div className="info-container small-items">{rows.map(convertRowToItem)}</div>
    </div>
  );
}

export default CreditTerms;
