import React, { Component } from 'react';
import { BN } from 'bn.js';
import { pool } from '../ethereum/pool';
import { erc20 } from '../ethereum/erc20';
import { fromAtomic, toAtomic } from '../ethereum/erc20';

class DepositForm extends Component {
  constructor(props) {
    super(props);
    console.log("The pool balance is...", this.props.poolData.balance);
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
    console.log("Deposit Amount is...", depositAmount);
    return erc20.methods.approve(pool._address, toAtomic(10000)).send({from: this.props.capitalProvider.address, gasPrice: new BN('20000000000'), gas: new BN('6721975')}).then((result) => {
      console.log("Result of approval is..", result);
      return pool.methods.deposit(depositAmount).send({from: this.props.capitalProvider.address, gasPrice: new BN('20000000000'), gas: new BN('6721975')}).then((result) => {
        this.setState({value: '', showSuccess: true});
        this.props.actionComplete();
      }).catch((error) => {
        console.log("Error from depositing is...", error);
      });
    }).catch((error) => {
      console.log("Error from approval is...", error);
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
