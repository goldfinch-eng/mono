import React, { Component } from 'react';
import web3 from '../web3';
import { pool } from '../ethereum/pool';

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
    const depositAmount = web3.utils.toWei(this.state.value);
    return pool.methods.deposit().send({from: this.props.capitalProvider.address, value: String(depositAmount)}).then((result) => {
      this.setState({value: '', showSuccess: true});
      this.props.actionComplete();
    });
  }

  render() {
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div onClick={() => { this.setShow('deposit') }} className='form-nav-option selected'>Deposit</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        <p className="form-message">Deposit funds into the pool, and receive a portion of future interest. The current pool size is {web3.utils.fromWei(this.props.poolData.balance)}.</p>
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
