import React from 'react';
import { usdcFromAtomic } from '../ethereum/erc20.js';
import { displayDollars } from '../utils';

function CreditBarViz(props) {
  const drawdownBalance = usdcFromAtomic(props.creditLine.balance);
  const totalCreditLimit = usdcFromAtomic(props.creditLine.limit);
  const availableToDrawdown = usdcFromAtomic(props.creditLine.availableCredit);
  const leftBarStyle = { width: (100 * drawdownBalance) / totalCreditLimit + '%' };
  const rightBarStyle = { width: (100 * availableToDrawdown) / totalCreditLimit + '%' };
  return (
    <div className="bar-viz background-container-inner">
      <div className="full-bar">
        <div className="bar-left" style={leftBarStyle}></div>
        <div className="bar-right" style={rightBarStyle}></div>
      </div>
      <div className="left-label">
        <div className="amount">{displayDollars(drawdownBalance)}</div>
        <div className="description">Drawdown balance</div>
      </div>
      <div className="right-label">
        <div className="amount">{displayDollars(availableToDrawdown)}</div>
        <div className="description">Available to drawdown</div>
      </div>
    </div>
  );
}

export default CreditBarViz;
