import React from 'react';
import { fromAtomic } from '../ethereum/erc20.js';

function CreditBarViz(props) {
  const drawdownBalance = fromAtomic(props.creditLine.balance);
  const totalCreditLimit = fromAtomic(props.creditLine.limit);
  const availableToDrawdown = totalCreditLimit - drawdownBalance;
  const leftBarStyle = { width: (100 * drawdownBalance) / totalCreditLimit + '%' };
  const rightBarStyle = { width: (100 * availableToDrawdown) / totalCreditLimit + '%' };

  return (
    <div className="bar-viz">
      <div className="full-bar">
        <div className="bar-left" style={leftBarStyle}></div>
        <div className="bar-right" style={rightBarStyle}></div>
      </div>
      <div className="left-label">
        <div className="amount">${drawdownBalance}</div>
        <div className="description">Drawdown balanace</div>
      </div>
      <div className="right-label">
        <div className="amount">${availableToDrawdown}</div>
        <div className="description">Available to drawdown</div>
      </div>
    </div>
  );
}

export default CreditBarViz;
