import React from 'react';
import { fromAtomic } from '../ethereum/erc20.js';

function PaymentStatus(props) {
  if (!props.creditLine.balance || parseFloat(props.creditLine.nextDueAmount) === 0) {
    return '';
  }

  const dueDate = props.creditLine.dueDate;
  const totalPaymentDue = fromAtomic(props.creditLine.nextDueAmount);
  const prepaidAmount = fromAtomic(props.creditLine.prepaymentBalance);
  const remainingAmount = totalPaymentDue - prepaidAmount;
  const leftBarStyle = { width: (100 * remainingAmount) / totalPaymentDue + '%' };
  const rightBarStyle = { width: (100 * prepaidAmount) / totalPaymentDue + '%' };

  return (
    <div className="info-section">
      <h2>Next payment due {dueDate}</h2>
      <div className="info-container payment-status">
        <div className="bar-viz small">
          <div className="full-bar">
            <div className="bar-left" style={leftBarStyle}></div>
            <div className="bar-right" style={rightBarStyle}></div>
          </div>
          <div className="left-label">
            <div className="amount">${remainingAmount}</div>
            <div className="description">Remaining due</div>
          </div>
          <div className="right-label">
            <div className="amount">${prepaidAmount}</div>
            <div className="description">Already paid</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentStatus;
