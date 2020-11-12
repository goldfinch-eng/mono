import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import { usdcFromAtomic } from '../ethereum/erc20';
import { displayDollars } from '../utils';

class DepositStatus extends Component {
  deriveRows = () => {
    let balance = '0';
    let poolBalance = '0';
    let totalDrawdowns = '0';
    if (this.props.poolData.totalShares) {
      balance = usdcFromAtomic(this.props.poolData.balance);
      poolBalance = usdcFromAtomic(this.props.poolData.totalPoolBalance);
      totalDrawdowns = usdcFromAtomic(this.props.poolData.totalDrawdowns);
    }

    return [
      { label: 'Total pool balance', value: displayDollars(poolBalance) },
      { label: 'Loans outstanding', value: displayDollars(totalDrawdowns) },
      { label: 'Remaining in pool', value: displayDollars(balance) },
    ];
  };

  render() {
    return (
      <div className="pool-status background-container">
        <h2>Pool Status</h2>
        <InfoSection rows={this.deriveRows()} />
      </div>
    );
  }
}

export default DepositStatus;
