import React, { Component } from 'react';

class WithdrawalForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      amount: 0,
    };
  }

  submitDeposit = () => {
    console.log("I would be submitting prepayment!!")
  }

  render() {
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div className="form-nav-option selected">Deposit</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        <div>
          <p className="form-message">Withdrawal funds from your available balance of $20,305.00</p>
          <div className="form-inputs">
            <div className="input-container"><input className="big-number-input"></input></div>
            <button className="button-dk submit-payment">Make Withdrawal</button>
          </div>
        </div>
      </div>
    )
  }
}

export default WithdrawalForm;
