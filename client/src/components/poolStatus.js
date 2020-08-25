import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import { fromAtomic } from '../ethereum/erc20';

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
    return [
      {text: 'Total Shares', value: totalShares},
      {text: 'Share Price', value: sharePrice},
      {text: 'Funds Currently In Pool', value: balance}
    ]
  }

  render() {
    return (
      <InfoSection
        title="Pool Status"
        rows={this.deriveRows()}
      />
    )
  }
}

export default DepositStatus;
