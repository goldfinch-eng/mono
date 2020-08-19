import React, { Component } from 'react';
import web3 from '../web3';
import { pool } from '../ethereum/pool';

class WithdrawalForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: '',
      showSuccess: false,
    };
  }

  handleChange = (e) => {
    this.setState({
      value: e.target.value,
      showSuccess: false,
    });
  }

  action = () => {
    const withdrawalAmount = web3.utils.toWei(this.state.value);
    return pool.methods.withdraw(withdrawalAmount).send({from: this.props.capitalProvider.address}).then((result) => {
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
        <p className="form-message">Withdrawal funds from the pool, up to your balance of {web3.utils.fromWei(this.props.capitalProvider.availableToWithdrawal)}.</p>
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
