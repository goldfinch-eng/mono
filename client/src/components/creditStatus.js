import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import { fromAtomic } from '../ethereum/erc20.js';

class CreditStatus extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: [
        {text: `Available To Draw Down`, value: '0'},
        {text: 'Current Drawdown Balance', value: '0'},
        {text: 'Total Credit Limit', value: '0'},
      ],
    };
  }

  async componentDidUpdate(props) {
    if (this.props === props || !this.props.creditLine.methods) {
      return;
    }
    const drawdownBalance = fromAtomic(await this.props.creditLine.methods.balance().call());
    const totalCreditLimit = fromAtomic(await this.props.creditLine.methods.limit().call());
    const availableToDrawdown = totalCreditLimit - drawdownBalance;
    const rows = [
      {text: `Available To Draw Down`, value: availableToDrawdown},
      {text: 'Current Drawdown Balance', value: drawdownBalance},
      {text: 'Total Credit Limit', value: totalCreditLimit},
    ];
    this.setState({
      rows: rows
    });
  }

  render() {
    return (
      <InfoSection
        title="Credit Status"
        rows={this.state.rows}
      />
    )
  }
}

export default CreditStatus;