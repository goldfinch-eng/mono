import React from 'react';
import InfoSection from './infoSection.js';
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
      // { label: 'Required collateral', value: '- %' },
    ];
  } else {
    const limit = fromAtomic(props.creditLine.limit);
    const interestRateAPR = fromAtomic(props.creditLine.interestAprDecimal) * 100;
    const paymentFrequency = fromAtomicDecimals(props.creditLine.paymentPeriodInDays);
    const paybackTerm = fromAtomicDecimals(props.creditLine.termInDays);
    // const requiredCollateral = fromAtomicDecimals(props.creditLine.minCollateralPercent);

    rows = [
      { label: 'Limit', value: '$' + displayNumber(limit, 2) },
      { label: 'Interest rate APR', value: displayNumber(interestRateAPR, 2) + '%' },
      { label: 'Payment frequency', value: paymentFrequency + ' days' },
      { label: 'Payback term', value: paybackTerm + ' days' },
      // { label: 'Required collateral', value: displayNumber(requiredCollateral, 2) + '%' },
    ];
  }

  return <InfoSection title="Credit Terms" rows={rows} cssClass={cssClass} />;
}

export default CreditTerms;
