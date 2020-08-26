import React from 'react';
import InfoSection from './infoSection.js';
import { fromAtomic } from '../ethereum/erc20.js';

function DepositStatus(props) {

  function deriveRows() {
    let numShares = "0";
    let availableToWithdrawal = "0";
    if (props.capitalProvider.numShares) {
      numShares = fromAtomic(props.capitalProvider.numShares);
      availableToWithdrawal = fromAtomic(props.capitalProvider.availableToWithdrawal);
    }
    return [
      {text: 'Your Total Shares', value: numShares},
      {text: 'Available To Withdrawal', value: availableToWithdrawal}
    ]
  }

  return (
    <InfoSection
      title="Deposit Status"
      rows={deriveRows()}
    />
  )
}

export default DepositStatus;
