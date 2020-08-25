import React, { Component } from 'react';
import { pool } from '../ethereum/pool';
import { erc20 } from '../ethereum/erc20';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils';

class DepositForm extends Component {
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
    const depositAmount = toAtomic(this.state.value);
    const userAddress = this.props.capitalProvider.address;
    return sendFromUser(erc20.methods.approve(pool._address, toAtomic(10000)), userAddress).then((result) => {
      return sendFromUser(pool.methods.deposit(depositAmount), userAddress).then((result) => {
        this.setState({value: '', showSuccess: true});
        this.props.actionComplete();
      });
    });
  }

  render() {
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div onClick={() => { this.setShow('deposit') }} className='form-nav-option selected'>Deposit</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        <p className="form-message">Deposit funds into the pool, and receive a portion of future interest. The current pool size is {fromAtomic(this.props.poolData.balance)}.</p>
        <div className="form-inputs">
          <div className="input-container">
            <input value={this.state.value} placeholder='10.0' onChange={this.handleChange} className="big-number-input"></input>
          </div>
          <button onClick={() => {this.action()}} className="button-dk submit-payment">Make Deposit</button>
        </div>
        {this.state.showSuccess ? <div className="form-message">Deposit successfully completed!</div> : ""}
      </div>
    )
  }
}

export default DepositForm;
