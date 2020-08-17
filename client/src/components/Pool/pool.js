import React, {Component} from 'react';
import web3 from '../../web3';
import { Button } from 'rimble-ui';

class Pool extends Component {
  constructor(props) {
    super(props);
    this.state = {
      balance: 0,
    };
    web3.eth.getBalance(props.instance._address).then((result) => {
      console.log("In the eth getBalance function with result", result);
      var balance = web3.utils.fromWei(result);
      this.setState({
        balance: balance,
      });
    })
  }


  deposit = async() => {
    var accounts = await web3.eth.getAccounts();
    var account = accounts[0];
    var balance = web3.utils.fromWei(await web3.eth.getBalance(this.props.instance._address));

    console.log("Pool balance before..", balance);
    var amountToDeposit = String(100000000)
    var result = await this.props.instance.methods.deposit().send({value: amountToDeposit , from: account});
    console.log("Result of depositing is...", result);
    var balanceAfter = web3.utils.fromWei(await web3.eth.getBalance(this.props.instance._address));
    this.setState({balance: balanceAfter});
    console.log("Pool balance before..", balanceAfter);
  };

  // getBalance = async() => {
  //   return "hey"
    // return web3.utils.fromWei(await web3.eth.getBalance(this.props.instance()), 'ether')
  // }

  render() {
    return (
      <div>
        <h1>Hey Im the pool, and Im at {this.props.instance._address}</h1>
        <h3>The balance of the pool is {this.state.balance}</h3>
        <Button onClick={this.deposit}>Deposit funds now!</Button>
      </div>
    )
  }
}

export default Pool;