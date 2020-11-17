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

  function updateTX(txToUpdate, updates) {
    setCurrentTXs(currentTXs => {
      const matches = _.remove(currentTXs, { id: txToUpdate.id });
      const tx = matches && matches[0];
      const newTXs = _.reverse(_.sortBy(_.concat(currentTXs, { ...tx, ...updates }), 'blockNumber'));
      return newTXs;
    });
  }

  var addPendingTX = txData => {
    const randomID = Math.floor(Math.random() * Math.floor(1000000000));
    const tx = { status: 'pending', id: randomID, confirmations: 0, ...txData };
    setCurrentTXs(currentTXs => {
      const newTxs = _.concat(currentTXs, tx);
      return newTxs;
    });
    return tx;
  };

  var markTXSuccessful = tx => {
    updateTX(tx, { status: 'successful' });
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
    erc20: erc20,
    goldfinchConfig: goldfinchConfig,
    network: network,
    refreshUserData: refreshUserData,
    addPendingTX: addPendingTX,
    markTXSuccessful: markTXSuccessful,
    markTXErrored: markTXErrored,
    removeError: removeError,
    updateTX: updateTX,
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
