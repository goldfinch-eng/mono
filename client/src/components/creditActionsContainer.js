import React, { Component } from 'react';
import PaymentForm from './paymentForm.js';

class CreditActionsContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showAction: null,
    };
  }

  openAction = (e, action) => {
    e.preventDefault();
    this.setState({
      showAction: action,
    });
  }

  cancelAction = (e) => {
    this.setState({
      showAction: null,
    });
  }

  render() {
    let formBody;
    if (this.state.showAction === null) {
      formBody = (
        <div className="form-start">
          <button onClick={(e) => { this.openAction(e, "drawdown") } } className="button-dk big">Start Drawdown</button>
          <button onClick={(e) => { this.openAction(e, "payment") } } className="button-dk big">Start Payment</button>
        </div>
      )
    } else if (this.state.showAction === "payment") {
      formBody = (
        <PaymentForm cancelAction={this.cancelAction}/>
      )
    } else if (this.state.showAction === "drawdown") {
      formBody = (
        <div className="form-full">
          <nav className="form-nav">
            <div onClick={this.cancelAction} className="form-nav-option cancel">Cancel</div>
          </nav>
          <p className="form-message">You can drawdown some sweet sweet cash.</p>
          <div className="form-inputs">
            <div className="input-container"><input className="big-number-input"></input></div>
            <button className="button-dk submit-payment">Make Drawdown</button>
          </div>
        </div>
      )
    }
    return (
      <div className="form-section">
        {formBody}
      </div>
    )
  }
}

export default CreditActionsContainer;
