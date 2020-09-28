import React from 'react';
import { fromAtomic } from '../ethereum/erc20.js';
import { displayNumber } from '../utils';
import iconBank from '../images/bank-blue.svg';

function DepositStatus(props) {
  let portfolioBalance = 0;
  if (props.capitalProvider.numShares) {
    portfolioBalance = fromAtomic(props.capitalProvider.availableToWithdrawal);
  }
  const portfolioBalanceDisplay = '$' + displayNumber(portfolioBalance, 2);

  return (
    <div className="metric-header">
      <img className="icon" src={iconBank} alt="balance-icon" />
      <div className="label">Your portfolio balance</div>
      <div className="value">{portfolioBalanceDisplay}</div>
    </div>
  );
}

export default DepositStatus;
