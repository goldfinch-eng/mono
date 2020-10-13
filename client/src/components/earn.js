import React, { useState, useEffect, useContext } from 'react';
import EarnActionsContainer from './earnActionsContainer.js';
import DepositStatus from './depositStatus.js';
import PoolStatus from './poolStatus.js';
import web3 from '../web3.js';
import { fetchCapitalProviderData, fetchPoolData } from '../ethereum/pool.js';
import { AppContext } from '../App.js';

function Earn(props) {
  const { pool, erc20, user } = useContext(AppContext);
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
    refreshCapitalProviderData(pool, capitalProvider.address);
  }

  async function refreshCapitalProviderData(pool, address) {
    const capitalProvider = await fetchCapitalProviderData(pool, address);
    setCapitalProvider(capitalProvider);
  }

  async function refreshPoolData(pool, erc20) {
    const poolData = await fetchPoolData(pool, erc20);
    setPoolData(poolData);
  }

  let depositInfo = '';
  if (!user.address) {
    depositInfo = (
      <div className="content-empty-message background-container">
        You are not currently connected to Metamask. In order to earn, you first need to connect to Metamask.
      </div>
    );
  } else {
    depositInfo = <DepositStatus capitalProvider={capitalProvider} />;
  }

  return (
    <div className="content-section">
      <div className="page-header">Earn Portfolio</div>
      {depositInfo}
      <EarnActionsContainer poolData={poolData} capitalProvider={capitalProvider} actionComplete={actionComplete} />
      {/* These need to be updated to be the correct fields for earning! */}
      <PoolStatus poolData={poolData} />
    </div>
  );
}

export default Earn;
