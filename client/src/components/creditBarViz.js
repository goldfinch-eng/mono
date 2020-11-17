import BigNumber from 'bignumber.js';
import React from 'react';
import { usdcFromAtomic } from '../ethereum/erc20.js';
import { displayDollars, roundUpPenny } from '../utils';

function CreditBarViz(props) {
  const remainingTotalDueAmount = props.creditLine.remainingTotalDueAmount;
  const availableToDrawdown = BigNumber.min(props.creditLine.availableCredit, props.creditLine.limit);
  const totalForBar = remainingTotalDueAmount.plus(availableToDrawdown);
  const leftBarStyle = { width: `${remainingTotalDueAmount.multipliedBy(100).dividedBy(totalForBar)}%` };
  const rightBarStyle = { width: `${availableToDrawdown.multipliedBy(100).dividedBy(totalForBar)}%` };
  return (
    <div className="bar-viz background-container-inner">
      <div className="full-bar">
        <div className="bar-left" style={leftBarStyle}></div>
        <div className="bar-right" style={rightBarStyle}></div>
      </div>
      <div className="left-label">
        <div className="amount">{displayDollars(roundUpPenny(usdcFromAtomic(remainingTotalDueAmount)))}</div>
        <div className="description">Drawdown + interest balance</div>
      </div>
      <div className="right-label">
        <div className="amount">{displayDollars(roundUpPenny(usdcFromAtomic(availableToDrawdown)))}</div>
        <div className="description">Available to drawdown</div>
      </div>
    </div>
  );
}

export default CreditBarViz;
