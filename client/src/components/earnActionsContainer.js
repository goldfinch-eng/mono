import React, { Component } from 'react';
import DepositForm from './depositForm.js';
import WithdrawalForm from './withdrawalForm.js';

class EarnActionsContainer extends Component {
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
          <button onClick={(e) => { this.openAction(e, "deposit") } } className="button-dk big">Start Deposit</button>
          <button onClick={(e) => { this.openAction(e, "withdrawal") } } className="button-dk big">Start Withdrawal</button>
        </div>)
    } else if (this.state.showAction === "deposit") {
      formBody = (
        <DepositForm cancelAction={this.cancelAction}/>
      )
    } else if (this.state.showAction === "withdrawal") {
      formBody = (
        <WithdrawalForm cancelAction={this.cancelAction}/>
      )
    }
    return (
      <div className="form-section">
        {formBody}
      </div>
    )
  }
}

export default EarnActionsContainer;