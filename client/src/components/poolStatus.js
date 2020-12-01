import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import { usdcFromAtomic } from '../ethereum/erc20';
import { displayDollars } from '../utils';

class DepositStatus extends Component {
  deriveRows = () => {
    let balance;
    let poolBalance;
    let totalDrawdowns;
    if (this.props.poolData.totalShares) {
      balance = usdcFromAtomic(this.props.poolData.balance);
      poolBalance = usdcFromAtomic(this.props.poolData.totalPoolAssets);
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
      <div className={`pool-status background-container ${this.props.poolData.totalShares ? '' : 'placeholder'}`}>
        <h2>Pool Status</h2>
        <InfoSection rows={this.deriveRows()} />
      </div>
    );
  }
}

export default DepositStatus;
