import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import web3 from '../web3.js';

class DepositStatus extends Component {

  deriveRows = () => {
    let numShares = "0";
    let availableToWithdrawal = "0";
    if (this.props.capitalProvider.numShares) {
      numShares = web3.utils.fromWei(this.props.capitalProvider.numShares);
      availableToWithdrawal = web3.utils.fromWei(this.props.capitalProvider.availableToWithdrawal);
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
