import React, { Component } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import PaymentStatus from './paymentStatus.js';
import CreditStatus from './creditStatus.js';
import web3 from '../web3.js';
import creditDesk from '../ethereum/creditDesk.js';
import getCreditLine from '../ethereum/creditLine.js';

class Borrow extends Component {
  constructor(props) {
    super(props);
    this.state = {
      borrower: '',
      creditLine: '',
    }
  }

  async componentDidMount() {
    const [borrower] = await web3.eth.getAccounts();
    const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrower).call();
    const creditLine = getCreditLine(borrowerCreditLines[0]);

    console.log("Should be setting state of the borrower and creditline", borrower, creditLine);

    this.setState({
      borrower: borrower,
      creditLine: creditLine,
    });
  }

  actionComplete = () => {
    console.log("Action has completed...");
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