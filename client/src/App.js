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
import { getErc20 } from './ethereum/erc20.js';
import { decimals } from './ethereum/utils';

const AppContext = React.createContext({});

function App() {
  const [pool, setPool] = useState(null);
  const [creditDesk, setCreditDesk] = useState(null);
  const [erc20, setErc20] = useState(null);
  const [user, setUser] = useState({});
  const [currentTXs, setCurrentTXs] = useState([]);
  const [currentErrors, setCurrentErrors] = useState([]);

  useEffect(() => {
    setupWeb3();
  }, []);

  async function setupWeb3() {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length > 0) {
      const networkType = await web3.eth.net.getNetworkType();
      let erc20Contract = getErc20(networkType);
      setErc20(erc20Contract);
      setUser(await getUserData(accounts[0], erc20Contract));
      setPool(getPool(networkType));
      setCreditDesk(getCreditDesk(networkType));
    }
  }

  async function getUserData(address, erc20Contract) {
    let usdcBalance = new BN(0);
    if (erc20Contract) {
      usdcBalance = await erc20Contract.methods.balanceOf(address).call();
    }
    return {
      address: address,
      usdcBalance: String(new BN(usdcBalance).div(decimals)),
    };
  }

  var addPendingTX = pendingTX => {
    setCurrentTXs(currentPendingTXs => {
      const newPendingTxs = _.concat(currentPendingTXs, pendingTX);
      console.log('After setting... the pending txs are', currentTXs);
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
    erc20: erc20,
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
