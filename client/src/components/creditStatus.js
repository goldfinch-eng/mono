import React from 'react';
import InfoSection from './infoSection.js';
import CreditBarViz from './creditBarViz.js';
import { usdcFromAtomic } from '../ethereum/erc20.js';
import { decimals } from '../ethereum/utils';
import { displayNumber } from '../utils';

function CreditStatus(props) {
  function fromAtomicDecimals(val) {
    return usdcFromAtomic(val) * decimals;
  }

  let placeholderClass = '';
  if (!props.user.address || !props.user.usdcIsUnlocked || !props.creditLine.balance) {
    placeholderClass = 'placeholder';
  }

  let rows;
  if (!props.creditLine.balance) {
    rows = [
      { label: 'Limit', value: '$ -' },
      { label: 'Interest rate APR', value: '- %' },
      { label: 'Payment frequency', value: '-' },
      { label: 'Payback term', value: '-' },
    ];
  } else {
    const limit = usdcFromAtomic(props.creditLine.limit);
    const interestRateAPR = props.creditLine.interestAprDecimal.multipliedBy(100);
    const paymentFrequency = fromAtomicDecimals(props.creditLine.paymentPeriodInDays);
    const paybackTerm = fromAtomicDecimals(props.creditLine.termInDays);

    rows = [
      { label: 'Limit', value: '$' + displayNumber(limit, 2) },
      { label: 'Interest rate APR', value: displayNumber(interestRateAPR, 2) + '%' },
      { label: 'Payment frequency', value: paymentFrequency + ' days' },
      { label: 'Payback term', value: paybackTerm + ' days' },
    ];
  }

  return (
    <div className={`credit-status background-container ${placeholderClass}`}>
      <h2>Credit Status</h2>
      <CreditBarViz creditLine={props.creditLine} />
      <InfoSection rows={rows} />
    </div>
  );
}

export default CreditStatus;
