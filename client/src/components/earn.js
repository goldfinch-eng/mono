import React, { Component } from 'react';
import EarnActionsContainer from './earnActionsContainer.js';
import DepositStatus from './depositStatus.js';
import PoolStatus from './poolStatus.js';
import web3 from '../web3.js';
import { fetchCapitalProviderData, fetchPoolData } from '../ethereum/pool.js';

class Earn extends Component {
  constructor(props) {
    super(props);
    this.state = {
      capitalProvider: {},
      poolData: {},
    }
    this.actionComplete = this.actionComplete.bind(this);
  }

  async componentDidMount() {
    const [capitalProviderAddress] = await web3.eth.getAccounts();
    console.log("Capital provider address is...", capitalProviderAddress);
    this.refreshPoolData()
    this.refreshCapitalProviderData(capitalProviderAddress);
  }

  actionComplete () {
    this.refreshCapitalProviderData(this.state.capitalProvider.address);
    this.refreshPoolData();
  }

  async refreshCapitalProviderData(address) {
    const capitalProvider = await fetchCapitalProviderData(address);
    console.log("Setting state of capital provider:", capitalProvider);
    this.setState({
      capitalProvider: capitalProvider,
    });
  }

  async refreshPoolData() {
    const poolData = await fetchPoolData();
    this.setState({
      poolData: poolData,
    })
  }

  render() {
    return (
      <div>
        <div className="content-header">Your Account</div>
        <EarnActionsContainer poolData={this.state.poolData} capitalProvider={this.state.capitalProvider} actionComplete={this.actionComplete}/>
        {/* These need to be updated to be the correct fields for earning! */}
        <DepositStatus capitalProvider={this.state.capitalProvider}/>
        <PoolStatus poolData={this.state.poolData}/>
      </div>
    )
  }
}

export default Earn;