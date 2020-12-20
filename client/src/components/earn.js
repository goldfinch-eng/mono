import React, { useState, useEffect, useContext } from 'react';
import EarnActionsContainer from './earnActionsContainer.js';
import PoolStatus from './poolStatus.js';
import ConnectionNotice from './connectionNotice.js';
import web3 from '../web3.js';
import { fetchCapitalProviderData, fetchPoolData } from '../ethereum/pool.js';
import { AppContext } from '../App.js';

function Earn(props) {
  const { pool, erc20, creditDesk } = useContext(AppContext);
  const [capitalProvider, setCapitalProvider] = useState({});
  const [poolData, setPoolData] = useState({});

  useEffect(() => {
    async function refreshAllData() {
      const [capitalProviderAddress] = await web3.eth.getAccounts();
      refreshPoolData(pool, erc20);
      refreshCapitalProviderData(pool, capitalProviderAddress);
    }
    refreshAllData();
  }, [pool, erc20]);

  function actionComplete() {
    refreshPoolData(pool, erc20);
    return refreshCapitalProviderData(pool, capitalProvider.address);
  }

  async function refreshCapitalProviderData(pool, address) {
    const capitalProvider = await fetchCapitalProviderData(pool, address);
    setCapitalProvider(capitalProvider);
  }

  async function refreshPoolData(pool, erc20) {
    const poolData = await fetchPoolData(pool, erc20);
    setPoolData(poolData);
  }

  let earnMessage = 'Loading...';

  if (capitalProvider.loaded) {
    earnMessage = 'Earn Portfolio';
  }

  return (
    <div className="content-section">
      <div className="page-header">{earnMessage}</div>
      <ConnectionNotice />
      <EarnActionsContainer poolData={poolData} capitalProvider={capitalProvider} actionComplete={actionComplete} />
      <PoolStatus poolData={poolData} creditDesk={creditDesk} />
    </div>
  );
}

export default Earn;
