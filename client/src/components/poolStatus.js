import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import web3 from '../web3.js';

class DepositStatus extends Component {

  deriveRows = () => {
    let balance = '0';
    let totalShares = '0';
    let sharePrice = '0';
    if (this.props.poolData.totalShares) {
      balance = web3.utils.fromWei(this.props.poolData.balance);
      totalShares = web3.utils.fromWei(this.props.poolData.totalShares);
      sharePrice = web3.utils.fromWei(this.props.poolData.sharePrice);
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
