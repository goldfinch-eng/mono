import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import { fromAtomic } from '../ethereum/erc20';
import { displayDollars, displayNumber } from '../utils';

class DepositStatus extends Component {
  deriveRows = () => {
    let balance = '0';
    let poolBalance = '0';
    let totalDrawdowns = '0';
    if (this.props.poolData.totalShares) {
      balance = fromAtomic(this.props.poolData.balance);
      poolBalance = fromAtomic(this.props.poolData.totalPoolBalance);
      totalDrawdowns = fromAtomic(this.props.poolData.totalDrawDowns);
    }

    return [
      { label: 'Total pool balance', value: displayDollars(poolBalance) },
      { label: 'Loans outstanding', value: displayDollars(totalDrawdowns) },
      { label: 'Remaining in pool', value: displayDollars(balance) },
    ];
  };

  render() {
    return <InfoSection title="Pool Metrics" rows={this.deriveRows()} />;
  }
}

export default DepositStatus;
