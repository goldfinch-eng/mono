import React, { Component } from 'react';
import web3 from '../web3';
import creditDesk from '../ethereum/creditDesk';
import { sendFromUser } from '../ethereum/utils';
import { toAtomic } from '../ethereum/erc20';

class DrawdownForm extends Component {
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

  makeDrawdown = () => {
    const drawdownAmount = toAtomic(this.state.value);
    return sendFromUser(creditDesk.methods.drawdown(drawdownAmount, this.props.creditLine._address), this.props.borrower).then((result) => {
      this.setState({value: '', showSuccess: true});
      this.props.actionComplete();
    });
  }

  render() {
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div onClick={() => { this.setShow('drawdown') }} className='form-nav-option selected'>Drawdown</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        <p className="form-message">You can drawdown up to your credit limit.</p>
        <div className="form-inputs">
          <div className="input-container">
            <input value={this.state.value} placeholder="10.0" onChange={this.handleChange} className="big-number-input"></input>
          </div>
          <button onClick={() => {this.makeDrawdown()}} className="button-dk submit-payment">Make Drawdown</button>
        </div>
        {this.state.showSuccess ? <div className="form-message">Drawdown successfully completed!</div> : ""}
      </div>
    )
  }
}

export default DrawdownForm;
