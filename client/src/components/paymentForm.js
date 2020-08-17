import React, { Component } from 'react';

class PaymentForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      show: 'principalPayment',
    };
  }

  showPrepayment = (e) => {
    e.preventDefault();
    this.setState({
      show: 'prepayment',
    })
  }

  isSelected = (navItem) => {
    if (this.state.show == navItem) {
      return 'selected';
    };
  }

  setShow = (navItem) => {
    this.setState({
      show: navItem,
    });
  }

  submitPrepayment = () => {
    console.log("I would be submitting prepayment!!")
  }

  render() {
    let specificPaymentForm;
    if (this.state.show === 'prepayment') {
      specificPaymentForm = (
        <div>
          <p className="form-message">Directly pay down your current balance. $182 will be applied to current accrued interest before paying down principal.</p>
          <div className="form-inputs">
            <div className="input-container"><input className="big-number-input"></input></div>
            <button className="button-dk submit-payment">Submit Payment</button>
          </div>
          <div className="form-note">Note: After a principal payment of $15,000.00, your next payment due will be $496.30 on Oct 6, 2020.</div>
        </div>
      );
    } else {
      specificPaymentForm = (
        <div>
          <p className="form-message">Pay down your upcoming balance now.</p>
          <div className="form-inputs">
            <div className="input-container">
              <input className="big-number-input"></input>
            </div>
            <button onClick={this.submitPrepayment} className="button-dk submit-payment">Submit Pre-payment</button>
          </div>
        </div>
      );
    }
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div onClick={() => { this.setShow('prepayment') }} className={`form-nav-option ${this.isSelected('prepayment')}`}>Prepayment</div>
          <div onClick={() => { this.setShow('principalPayment') }} className={`form-nav-option ${this.isSelected('principalPayment')}`}>Principal Payment</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        {specificPaymentForm}
      </div>
    )
  }
}

export default PaymentForm;