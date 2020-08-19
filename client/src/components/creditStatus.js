import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import web3 from '../web3.js';

class CreditStatus extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: [],
    };
  }

  async componentDidUpdate(props) {
    if (this.props === props) {
      return;
    }
    const drawdownBalance = web3.utils.fromWei(await this.props.creditLine.methods.balance().call());
    const totalCreditLimit = web3.utils.fromWei(await this.props.creditLine.methods.limit().call());
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