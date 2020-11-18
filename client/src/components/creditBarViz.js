import React from 'react';
import { displayDollars } from '../utils';

function CreditBarViz(props) {
  const remainingTotalDueAmount = props.creditLine.remainingTotalDueAmountInDollars;
  const availableToDrawdown = props.creditLine.availableCreditInDollars;
  const totalForBar = remainingTotalDueAmount.plus(availableToDrawdown);
  const leftBarStyle = { width: `${remainingTotalDueAmount.multipliedBy(100).dividedBy(totalForBar)}%` };
  const rightBarStyle = { width: `${availableToDrawdown.multipliedBy(100).dividedBy(totalForBar)}%` };
  return (
    <div className="bar-viz">
      <div className="full-bar">
        <div className="bar-left" style={leftBarStyle}></div>
        <div className="bar-right" style={rightBarStyle}></div>
      </div>
      <div className="left-label">
        <div className="amount">{displayDollars(remainingTotalDueAmount)}</div>
        <div className="description">Drawdown + interest balance</div>
      </div>
      <div className="right-label">
        <div className="amount">{displayDollars(availableToDrawdown)}</div>
        <div className="description">Available to drawdown</div>
      </div>
    </div>
  );
}

export default CreditBarViz;
