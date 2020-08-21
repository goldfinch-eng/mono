import moment from 'moment';
import React, { Component } from 'react';
import InfoSection from './infoSection.js';
import web3 from '../web3.js';

class PaymentStatus extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: [{text: "No upcoming payments due", value: ""}],
    };
  }

  async componentDidUpdate(props) {
    if (this.props === props || !this.props.creditLine.methods) {
      return
    };
    const [nextDueBlock, prepaidAmount, amountDue]  = await Promise.all([
      this.props.creditLine.methods.nextDueBlock().call(),
      this.props.creditLine.methods.prepaymentBalance().call(),
      // TODO: This actually needs to be a new method that calculates expected amount due at your next due block
      this.props.creditLine.methods.balance().call(),
    ]);
    const latestBlock = await web3.eth.getBlock('latest');
    const numBlocksTillDueDate = nextDueBlock - latestBlock.number;
    const dueDate = moment().add(numBlocksTillDueDate * 15, 's').format("MMM Do");
    if (nextDueBlock > 0) {
      this.setState({
        rows: [
          {text: `Payment Due On ${dueDate}`, value: web3.utils.fromWei(amountDue)},
          {text: 'Prepaid Toward Payment Due', value: web3.utils.fromWei(prepaidAmount)}
        ]
      });
    } else {
      this.setState({
        rows: [{text: "No upcoming payments due", value: ""}],
      });
    }
  }

  render() {
    return (
      <InfoSection
        title="Payment Status"
        rows={this.state.rows}
      />
    )
  }
}

export default PaymentStatus;
