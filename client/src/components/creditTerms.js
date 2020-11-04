import React from 'react';
import InfoSection from './infoSection.js';
import { usdcFromAtomic } from '../ethereum/erc20.js';
import { decimals } from '../ethereum/utils';
import { displayNumber } from '../utils';

function CreditTerms(props) {
  function fromAtomicDecimals(val) {
    return usdcFromAtomic(val) * decimals;
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
    ];
  } else {
    const limit = usdcFromAtomic(props.creditLine.limit);
    const interestRateAPR = props.creditLine.interestAprDecimal.multipliedBy(100).toString(10);
    const paymentFrequency = fromAtomicDecimals(props.creditLine.paymentPeriodInDays);
    const paybackTerm = fromAtomicDecimals(props.creditLine.termInDays);

    rows = [
      { label: 'Limit', value: '$' + displayNumber(limit, 2) },
      { label: 'Interest rate APR', value: displayNumber(interestRateAPR, 2) + '%' },
      { label: 'Payment frequency', value: paymentFrequency + ' days' },
      { label: 'Payback term', value: paybackTerm + ' days' },
    ];
  }

  return <InfoSection title="Credit Terms" rows={rows} cssClass={cssClass} />;
}

export default CreditTerms;
