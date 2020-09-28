import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import { fromAtomic } from '../ethereum/erc20';
import { displayNumber } from '../utils';

class DepositStatus extends Component {
  deriveRows = () => {
    let balance = '0';
    let totalShares = '0';
    let sharePrice = '0';
    if (this.props.poolData.totalShares) {
      balance = fromAtomic(this.props.poolData.balance);
      totalShares = fromAtomic(this.props.poolData.totalShares);
      sharePrice = fromAtomic(this.props.poolData.sharePrice);
    }

    const poolBalance = totalShares * sharePrice;
    const totalDrawdowns = poolBalance - balance;

    return [
      { label: 'Total pool balance', value: '$' + displayNumber(poolBalance, 2) },
      { label: 'Loans outstanding', value: '$' + displayNumber(totalDrawdowns, 2) },
      { label: 'Remaining in pool', value: '$' + displayNumber(balance, 2) },
    ];
  };

  render() {
    return <InfoSection title="Pool Metrics" rows={this.deriveRows()} />;
  }
}

export default DepositStatus;
