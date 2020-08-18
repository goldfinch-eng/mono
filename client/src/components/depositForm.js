import React, { Component } from 'react';

class DepositForm extends Component {
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
          <p className="form-message">Deposit funds into the pool and receive a portion of future interest payments. The pool size is currently $120,500,000.00</p>
          <div className="form-inputs">
            <div className="input-container"><input className="big-number-input"></input></div>
            <button className="button-dk submit-payment">Make Deposit</button>
          </div>
        </div>
      </div>
    )
  }
}

export default DepositForm;