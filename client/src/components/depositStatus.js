import React from 'react';
import { displayNumber } from '../utils';
import { iconBank } from './icons.js';

function DepositStatus(props) {
  const portfolioBalance = props.capitalProvider.availableToWithdrawalInDollars || 0;
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
