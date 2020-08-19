import React, { Component } from 'react';
import web3 from '../web3';
import creditDesk from '../ethereum/creditDesk';

class DrawdownForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: '0',
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
    const drawdownAmount = web3.utils.toWei(this.state.value);
    return creditDesk.methods.drawdown(drawdownAmount, this.props.creditLine._address).send({from: this.props.borrower}).then((result) => {
      this.setState({value: 0, showSuccess: true});
      this.props.actionComplete();
    });
  }

  render() {
    return (
      <div className="form-full">
        <nav className="form-nav">
          <div onClick={() => { this.setShow('prepayment') }} className='form-nav-option selected'>Drawdown</div>
          <div onClick={this.props.cancelAction} className="form-nav-option cancel">Cancel</div>
        </nav>
        <p className="form-message">You can drawdown some sweet sweet cash.</p>
        <div className="form-inputs">
          <div className="input-container"><input value={this.state.value} onChange={this.handleChange} className="big-number-input"></input></div>
          <button onClick={() => {this.makeDrawdown()}} className="button-dk submit-payment">Make Drawdown</button>
        </div>
        {this.state.showSuccess ? <div className="form-message">Drawdown successfully completed!</div> : ""}
      </div>
    )
  }
}

export default DrawdownForm;
