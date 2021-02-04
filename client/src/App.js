import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import _ from 'lodash';
import Borrow from './components/borrow.js';
import Earn from './components/earn.js';
import Transactions from './components/transactions.js';
import NetworkWidget from './components/networkWidget';
import Sidebar from './components/sidebar';
import TermsOfService from './components/termsOfService.js';
import web3 from './web3';
import { fetchPoolData, getPool } from './ethereum/pool.js';
import { getCreditDesk, getAndSetCreditDeskData } from './ethereum/creditDesk.js';
import { getUSDC } from './ethereum/erc20.js';
import { getGoldfinchConfig, refreshGoldfinchConfigData } from './ethereum/goldfinchConfig.js';
import { getUserData, defaultUser } from './ethereum/user.js';
import { mapNetworkToID, SUPPORTED_NETWORKS } from './ethereum/utils';
import initSdk, { SafeInfo } from '@gnosis.pm/safe-apps-sdk';

const AppContext = React.createContext({});

function App() {
  const [pool, setPool] = useState({});
  const [creditDesk, setCreditDesk] = useState({});
  const [erc20, setErc20] = useState(null);
  const [user, setUser] = useState({});
  const [goldfinchConfig, setGoldfinchConfig] = useState({});
  const [currentTXs, setCurrentTXs] = useState([]);
  const [currentErrors, setCurrentErrors] = useState([]);
  const [network, setNetwork] = useState({});
  const [gnosisSafeInfo, setGnosisSafeInfo] = useState();
  const [gnosisSafeSdk, setGnosisSafeSdk] = useState();

  useEffect(() => {
    setupWeb3();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshUserData();
  }, [gnosisSafeInfo, erc20, pool, creditDesk, network]);

  async function setupWeb3() {
    if (!window.ethereum) {
      return;
    }

    // Initialize gnosis safe
    const safeSdk = initSdk();
    safeSdk.addListeners({
      onSafeInfo: setGnosisSafeInfo,
      onTransactionConfirmation: () => {},
    });
    setGnosisSafeSdk(safeSdk);

    const networkName = await web3.eth.net.getNetworkType();
    const networkId = mapNetworkToID[networkName] || networkName;
    const networkConfig = { name: networkId, supported: SUPPORTED_NETWORKS[networkId] };
    setNetwork(networkConfig);
    let erc20Contract, poolContract, goldfinchConfigContract, creditDeskContract;
    if (networkConfig.supported) {
      erc20Contract = await getUSDC(networkId);
      poolContract = await getPool(networkId);
      goldfinchConfigContract = await getGoldfinchConfig(networkId);
      creditDeskContract = await getCreditDesk(networkId);
      poolContract.gf = await fetchPoolData(poolContract, erc20Contract);
      setErc20(erc20Contract);
      setPool(poolContract);
      setCreditDesk(creditDeskContract);
      getAndSetCreditDeskData(creditDeskContract, setCreditDesk);
      setGoldfinchConfig(await refreshGoldfinchConfigData(goldfinchConfigContract));
    }

    return () => safeSdk.removeListeners();
  }

  async function refreshUserData() {
    let data = defaultUser();
    const accounts = await web3.eth.getAccounts();
    let userAddress = (gnosisSafeInfo && gnosisSafeInfo.safeAddress) || (accounts && accounts[0]) || user.address;
    // Set this to the borrower contract address to test gasless transactions
    // let userAddress = '0xd3D57673BAE28880376cDF89aeFe4653A5C84A08';
    if (userAddress && erc20 && creditDesk.loaded && pool.loaded) {
      data = await getUserData(userAddress, erc20, pool, creditDesk);
    }
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
    gnosisSafeInfo: gnosisSafeInfo,
    gnosisSafeSdk: gnosisSafeSdk,
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
          gnosisSafeInfo={gnosisSafeInfo}
          connectionComplete={setupWeb3}
        />
        <div>
          <Switch>
            <Route exact path="/">
              <Redirect to="/earn" />
            </Route>
            <Route path="/about">{/* <About /> */}</Route>
            <Route path="/borrow">
              <Borrow />
            </Route>
            <Route path="/earn">
              <Earn />
            </Route>
            <Route path="/transactions">
              <Transactions currentTXs={currentTXs} />
            </Route>
            <Route path="/terms">
              <TermsOfService />
            </Route>
          </Switch>
        </div>
        <footer>
          <a href="/terms">Terms</a>
        </footer>
      </Router>
    </AppContext.Provider>
  );
}

export { App, AppContext };
