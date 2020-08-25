import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import web3 from '../web3.js';
import { fromAtomic, toAtomic } from '../ethereum/erc20.js';

class DepositStatus extends Component {

  deriveRows = () => {
    let numShares = "0";
    let availableToWithdrawal = "0";
    if (this.props.capitalProvider.numShares) {
      numShares = fromAtomic(this.props.capitalProvider.numShares);
      availableToWithdrawal = fromAtomic(this.props.capitalProvider.availableToWithdrawal);
    }
    return [
      {text: 'Your Total Shares', value: numShares},
      {text: 'Available To Withdrawal', value: availableToWithdrawal}
    ]
  }

  render() {
    return (
      <InfoSection
        title="Deposit Status"
        rows={this.deriveRows()}
      />
    )
  }
}

export default DepositStatus;
