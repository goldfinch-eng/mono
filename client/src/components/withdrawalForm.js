import React, { Component } from 'react';
import { pool } from '../ethereum/pool';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils.js';

class WithdrawalForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: '',
      showSuccess: false,
    };
    this.action = this.action.bind(this);
  }

  handleChange = (e) => {
    this.setState({
      value: e.target.value,
      showSuccess: false,
    });
  }

  async action () {
    const withdrawalAmount = toAtomic(this.state.value);
    return sendFromUser(pool.methods.withdraw(withdrawalAmount), this.props.capitalProvider.address).then((result) => {
      this.setState({value: '', showSuccess: true});
      this.props.actionComplete();
    });
  }

  render() {
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div onClick={() => { this.setShow('withdrawal') }} className='form-nav-option selected'>Withdrawal</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        <p className="form-message">Withdrawal funds from the pool, up to your balance of {fromAtomic(this.props.capitalProvider.availableToWithdrawal)}.</p>
        <div className="form-inputs">
          <div className="input-container">
            <input value={this.state.value} placeholder='10.0' onChange={this.handleChange} className="big-number-input"></input>
          </div>
          <button onClick={() => {this.action()}} className="button-dk submit-payment">Make Withdrawal</button>
        </div>
        {this.state.showSuccess ? <div className="form-message">Withdrawal successfully completed!</div> : ""}
      </div>
    )
  }
}

export default WithdrawalForm;
