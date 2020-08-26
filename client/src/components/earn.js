import React, { useState, useEffect } from 'react';
import EarnActionsContainer from './earnActionsContainer.js';
import DepositStatus from './depositStatus.js';
import PoolStatus from './poolStatus.js';
import web3 from '../web3.js';
import { fetchCapitalProviderData, fetchPoolData } from '../ethereum/pool.js';

function Earn(props) {
  const [capitalProvider, setCapitalProvider] = useState({});
  const [poolData, setPoolData] = useState({});

  useEffect(() => {
    async function refreshAllData() {
      const [capitalProviderAddress] = await web3.eth.getAccounts();
      refreshPoolData();
      refreshCapitalProviderData(capitalProviderAddress);;
    }
    refreshAllData();
  }, []);

  function actionComplete () {
    refreshPoolData();
    refreshCapitalProviderData(capitalProvider.address);
  }

  async function refreshCapitalProviderData(address) {
    const capitalProvider = await fetchCapitalProviderData(address);
    setCapitalProvider(capitalProvider);
  }

  async function refreshPoolData() {
    const poolData = await fetchPoolData();
    setPoolData(poolData);
  }

  return (
    <div>
      <div className="content-header">Your Account</div>
      <EarnActionsContainer poolData={poolData} capitalProvider={capitalProvider} actionComplete={actionComplete}/>
      {/* These need to be updated to be the correct fields for earning! */}
      <DepositStatus capitalProvider={capitalProvider}/>
      <PoolStatus poolData={poolData}/>
    </div>
  )
}

export default Earn;