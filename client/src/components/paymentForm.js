import React, { Component } from 'react';
import web3 from '../web3';
import creditDesk from '../ethereum/creditDesk';

class PaymentForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      show: 'principalPayment',
      showSuccess: false,
      prepaymentValue: '',
      principalValue: '',
      interestOwed: '',
    };
  }

  isSelected = (navItem) => {
    if (this.state.show === navItem) {
      return 'selected';
    };
  }

  handleChange = (e, prop) => {
    this.setState({
      [prop]: e.target.value,
      showSuccess: false,
    });
  }

  setShow = (navItem) => {
    this.setState({
      show: navItem,
    });
  }

  setAccruedInterest = () => {
    // This is not working as expected, so removing the text,
    // but keeping the function for now.

    // if (!this.props.creditLine) {
    //   console.log("Looks like no credit line...")
    //   return;
    // }
    // console.log("Trying to set interestowed...")

    // this.props.creditLine.methods.interestOwed().call().then((interestOwed) => {
    //   console.log("Got it!", interestOwed)
    //   this.setState({interestOwed: interestOwed});
    // })
  }

  submitPrepayment = () => {
    const amount = web3.utils.toWei(this.state.prepaymentValue);
    return creditDesk.methods.prepay(this.props.creditLine._address).send({from: this.props.borrower, value: amount}).then((result) => {
      this.setState({prepaymentValue: 0, showSuccess: true});
      this.props.actionComplete();
    });
  }

  submitPrincipalPayment = () => {
    const amount = web3.utils.toWei(this.state.principalValue);
    return creditDesk.methods.pay(this.props.creditLine._address).send({from: this.props.borrower, value: amount}).then((result) => {
      this.setState({principalValue: 0, showSuccess: true});
      this.props.actionComplete();
    });
  }

  render() {
    let specificPaymentForm;
    if (this.state.show === 'principalPayment') {
      specificPaymentForm = (
        <div>
          <p className="form-message">Directly pay down your current balance.</p>
          <div className="form-inputs">
            <div className="input-container">
              <input value={this.state.principalValue} placeholder="10.0" onChange={(e) => {this.handleChange(e, "principalValue")}} className="big-number-input"></input>
            </div>
            <button onClick={this.submitPrincipalPayment} className="button-dk submit-payment">Submit Payment</button>
          </div>
          {/* Will need to add a new route or something to be able to display this text */}
          {/* <div className="form-note">Note: After a principal payment of $15,000.00, your next payment due will be $496.30 on Oct 6, 2020.</div> */}
        </div>
      );
    } else {
      specificPaymentForm = (
        <div>
          <p className="form-message">Pre-pay your upcoming balance now. This will be debited on your due date, and will not affect your current balance.</p>
          <div className="form-inputs">
            <div className="input-container">
              <input value={this.state.prepaymentValue} placeholder="10.0" onChange={(e) => {this.handleChange(e, "prepaymentValue")}} className="big-number-input"></input>
            </div>
            <button onClick={this.submitPrepayment} className="button-dk submit-payment">Submit Pre-payment</button>
          </div>
        </div>
      );
    }
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div onClick={() => { this.setShow('principalPayment'); this.setAccruedInterest(); }} className={`form-nav-option ${this.isSelected('principalPayment')}`}>Principal Payment</div>
          <div onClick={() => { this.setShow('prepayment') }} className={`form-nav-option ${this.isSelected('prepayment')}`}>Prepayment</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        {specificPaymentForm}
        {this.state.showSuccess ? <div className="form-message">Payment successfully completed!</div> : ""}
      </div>
    )
  }
}

export default PaymentForm;
