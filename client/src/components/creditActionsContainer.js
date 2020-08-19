import React, { Component } from 'react';
import PaymentForm from './paymentForm.js';
import DrawdownForm from './drawdownForm.js';

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
        <PaymentForm cancelAction={this.cancelAction} actionComplete={this.props.actionComplete} borrower={this.props.borrower} creditLine={this.props.creditLine}/>
      )
    } else if (this.state.showAction === "drawdown") {
      formBody = (
        <DrawdownForm cancelAction={this.cancelAction} actionComplete={this.props.actionComplete} borrower={this.props.borrower} creditLine={this.props.creditLine}/>
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
