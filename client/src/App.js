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

const AppContext = React.createContext({});

function App() {
  const [pool, setPool] = useState(null);
  const [creditDesk, setCreditDesk] = useState(null);
  const [erc20, setErc20] = useState(null);
  const [user, setUser] = useState();
  const [currentTXs, setCurrentTXs] = useState([]);

  useEffect(() => {
    setupWeb3();
  }, []);

  async function setupWeb3() {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length > 0) {
      const networkType = await web3.eth.net.getNetworkType();
      setUser(accounts[0]);
      setPool(getPool(networkType));
      setCreditDesk(getCreditDesk(networkType));
      setErc20(getErc20(networkType));
    }
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
  };

  const store = {
    pool: pool,
    creditDesk: creditDesk,
    user: user,
    erc20: erc20,
    addPendingTX: addPendingTX,
    markTXSuccessful: markTXSuccessful,
    markTXErrored: markTXErrored,
  };

  return (
    <AppContext.Provider value={store}>
      <Router>
        <Sidebar />
        <NetworkWidget user={user} setUser={setUser} currentTXs={currentTXs} connectionComplete={setupWeb3} />
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
