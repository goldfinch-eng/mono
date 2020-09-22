import React from 'react';
import InfoSection from './infoSection.js';
import { fromAtomic } from '../ethereum/erc20.js';

function PaymentStatus(props) {
  let rows;
  if (props.creditLine.nextDueBlock > 0) {
    rows = [
      { text: `Next Payment Due ${props.creditLine.dueDate}`, value: fromAtomic(props.creditLine.nextDueAmount) },
      { text: 'Prepaid Toward Payment Due', value: fromAtomic(props.creditLine.prepaymentBalance) },
      { text: 'Final Payment Due', value: props.creditLine.termEndDate },
    ];
  } else {
    rows = [{ text: 'No upcoming payments due', value: '' }];
  }

  return <InfoSection title="Payment Status" rows={rows} />;
}

export default PaymentStatus;
