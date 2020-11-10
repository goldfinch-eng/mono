import BN from 'bn.js';
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
import { getErc20, usdcFromAtomic } from './ethereum/erc20.js';
import { getGoldfinchConfig, refreshGoldfinchConfigData } from './ethereum/goldfinchConfig.js';

const AppContext = React.createContext({});

function App() {
  const [pool, setPool] = useState(null);
  const [creditDesk, setCreditDesk] = useState(null);
  const [erc20, setErc20] = useState(null);
  const [user, setUser] = useState({});
  const [goldfinchConfig, setGoldfinchConfig] = useState({});
  const [currentTXs, setCurrentTXs] = useState([]);
  const [currentErrors, setCurrentErrors] = useState([]);

  useEffect(() => {
    setupWeb3();
  }, []);

  async function setupWeb3() {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length > 0) {
      const networkType = await web3.eth.net.getNetworkType();
      let erc20Contract = await getErc20(networkType);
      let poolContract = await getPool(networkType);
      let goldfinchConfigContract = await getGoldfinchConfig(networkType);
      setErc20(erc20Contract);
      setPool(poolContract);
      refreshUserData(accounts[0], erc20Contract, poolContract);
      setCreditDesk(await getCreditDesk(networkType));
      setGoldfinchConfig(await refreshGoldfinchConfigData(goldfinchConfigContract));
    }
  }

  async function refreshUserData(address, erc20Contract, poolContract) {
    erc20Contract = erc20Contract || erc20;
    poolContract = poolContract || pool;
    address = address || user.address;
    let usdcBalance = new BN(0);
    let allowance = new BN(0);
    if (erc20Contract) {
      usdcBalance = await erc20Contract.methods.balanceOf(address).call();
    }
    if (poolContract && erc20Contract) {
      allowance = new BN(await erc20Contract.methods.allowance(address, poolContract._address).call());
    }
    const data = {
      address: address,
      usdcBalance: usdcFromAtomic(usdcBalance),
      usdcIsUnlocked: !allowance || !allowance.lte(new BN(10000)),
      allowance: allowance,
    };
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
