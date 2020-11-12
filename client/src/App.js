import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import _ from 'lodash';
import Borrow from './components/borrow.js';
import Earn from './components/earn.js';
import NetworkWidget from './components/networkWidget';
import Sidebar from './components/sidebar';
import web3 from './web3';
import { getPool } from './ethereum/pool.js';
import { getCreditDesk } from './ethereum/creditDesk.js';
import { getUSDC } from './ethereum/erc20.js';
import { getGoldfinchConfig, refreshGoldfinchConfigData } from './ethereum/goldfinchConfig.js';
import { getUserData } from './ethereum/user.js';
import { mapNetworkToID } from './ethereum/utils';

const AppContext = React.createContext({});

function App() {
  const [pool, setPool] = useState(null);
  const [creditDesk, setCreditDesk] = useState(null);
  const [erc20, setErc20] = useState(null);
  const [user, setUser] = useState({});
  const [goldfinchConfig, setGoldfinchConfig] = useState({});
  const [currentTXs, setCurrentTXs] = useState([]);
  const [currentErrors, setCurrentErrors] = useState([]);
  const [network, setNetwork] = useState('');

  useEffect(() => {
    setupWeb3();
  }, []);

  async function setupWeb3() {
    const accounts = await web3.eth.getAccounts();
    const networkName = await web3.eth.net.getNetworkType();
    const networkId = mapNetworkToID[networkName];
    let erc20Contract = await getUSDC(networkName);
    let poolContract = await getPool(networkName);
    let goldfinchConfigContract = await getGoldfinchConfig(networkName);
    setNetwork(networkId);
    setErc20(erc20Contract);
    setPool(poolContract);
    setCreditDesk(await getCreditDesk(networkName));
    setGoldfinchConfig(await refreshGoldfinchConfigData(goldfinchConfigContract));
    if (accounts.length > 0) {
      const creditDeskContract = await getCreditDesk(networkName);
      refreshUserData(accounts[0], erc20Contract, poolContract, creditDeskContract);
    }
  }

  async function refreshUserData(userAddress, erc20Contract, poolContract, creditDeskContract) {
    userAddress = userAddress || user.address;
    erc20Contract = erc20Contract || erc20;
    poolContract = poolContract || pool;
    creditDeskContract = creditDeskContract || creditDesk;
    const data = await getUserData(userAddress, erc20Contract, poolContract, creditDeskContract);
    setUser(data);
  }

  var addPendingTX = pendingTX => {
    setCurrentTXs(currentPendingTXs => {
      const newPendingTxs = _.concat(currentPendingTXs, pendingTX);
      return newPendingTxs;
    });
  };

  var markTXSuccessful = completedTX => {
    setCurrentTXs(currentPendingTXs => {
      const matches = _.remove(currentPendingTXs, { id: completedTX.id });
      const tx = matches && matches[0];
      tx.status = 'successful';
      const newPendingTxs = _.concat(currentPendingTXs, tx);
      return newPendingTxs;
    });
  };

  var markTXErrored = (failedTX, error) => {
    setCurrentTXs(currentPendingTXs => {
      const matches = _.remove(currentPendingTXs, { id: failedTX.id });
      const tx = matches && matches[0];
      tx.status = 'error';
      tx.errorMessage = error.message;
      const newPendingTxs = _.concat(currentPendingTXs, tx);
      return newPendingTxs;
    });
    setCurrentErrors(currentErrors => {
      return _.concat(currentErrors, { id: failedTX.id, message: error.message });
    });
  };

  var removeError = error => {
    setCurrentErrors(currentErrors => {
      _.remove(currentErrors, { id: error.id });
      return _.cloneDeep(currentErrors);
    });
  };

  const store = {
    pool: pool,
    creditDesk: creditDesk,
    user: user,
    refreshUserData: refreshUserData,
    erc20: erc20,
    goldfinchConfig: goldfinchConfig,
    addPendingTX: addPendingTX,
    markTXSuccessful: markTXSuccessful,
    markTXErrored: markTXErrored,
    removeError: removeError,
  };

  return (
    <AppContext.Provider value={store}>
      <Router>
        <Sidebar />
        <NetworkWidget
          user={user}
          network={network}
          setUser={setUser}
          currentErrors={currentErrors}
          currentTXs={currentTXs}
          connectionComplete={setupWeb3}
        />
        <div>
          <Switch>
            <Route exact path="/">
              <Borrow />
            </Route>
            <Route path="/about">{/* <About /> */}</Route>
            <Route path="/earn">
              <Earn />
            </Route>
          </Switch>
        </div>
      </Router>
    </AppContext.Provider>
  );
}

export { App, AppContext };
