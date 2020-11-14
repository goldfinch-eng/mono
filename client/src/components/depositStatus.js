import React from 'react';
import { fiduFromAtomic } from '../ethereum/fidu.js';
import { displayNumber } from '../utils';
import { iconBank } from './icons.js';

function DepositStatus(props) {
  let portfolioBalance = 0;
  if (props.capitalProvider.numShares) {
    portfolioBalance = fiduFromAtomic(props.capitalProvider.availableToWithdrawal);
  }
  const portfolioBalanceDisplay = '$' + displayNumber(portfolioBalance, 2);

  return (
    <div className="deposit-status background-container-inner">
      {iconBank}
      <div className="label">Your portfolio balance</div>
      <div className="value">{portfolioBalanceDisplay}</div>
    </div>
  );
}

export default DepositStatus;
