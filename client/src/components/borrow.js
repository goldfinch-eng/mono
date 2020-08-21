import React, { Component } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import PaymentStatus from './paymentStatus.js';
import CreditStatus from './creditStatus.js';
import web3 from '../web3.js';
import creditDesk from '../ethereum/creditDesk.js';
import { buildCreditLine } from '../ethereum/creditLine.js';

class Borrow extends Component {
  constructor(props) {
    super(props);
    this.state = {
      borrower: '',
      creditLine: {},
    }
  }

  async componentDidMount() {
    let creditLine = {};
    const [borrower] = await web3.eth.getAccounts();
    if (borrower) {
      const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrower).call();
      if (borrowerCreditLines.length) {
        creditLine = buildCreditLine(borrowerCreditLines[0]);
      }
    }

    this.setState({
      borrower: borrower,
      creditLine: creditLine,
    });
  }

  actionComplete = () => {
    this.setState({
      borrower: this.state.borrower,
      creditLine: this.state.creditLine,
    });
  }

  render() {
    return (
      <div>
        <div className="content-header">Your Credit Line</div>
        <CreditActionsContainer borrower={this.state.borrower} creditLine={this.state.creditLine} actionComplete={this.actionComplete}/>
        <PaymentStatus creditLine={this.state.creditLine}/>
        <CreditStatus creditLine={this.state.creditLine}/>
      </div>
    )
  }
}

export default Borrow;