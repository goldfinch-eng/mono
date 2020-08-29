import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
} from "react-router-dom";
import Borrow from './components/borrow.js';
import Earn from './components/earn.js';
import Footer from "./components/footer";
import Header from "./components/header";
import web3 from './web3';
import { getPool } from './ethereum/pool.js';
import { getCreditDesk } from './ethereum/creditDesk.js';
import { getErc20 } from './ethereum/erc20.js';

const AppContext = React.createContext({});

function App() {
  const [pool, setPool] = useState(null);
  const [creditDesk, setCreditDesk] = useState(null);
  const [erc20, setErc20] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log("Running the app use effect");
    setupWeb3();
  }, []);

  async function setupWeb3() {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length > 0) {
      const networkType = await web3.eth.net.getNetworkType();
      setUser(accounts[0]);
      setPool(getPool(networkType))
      setCreditDesk(getCreditDesk(networkType))
      setErc20(getErc20(networkType))
    }
  }

  const store = {
    pool: pool,
    creditDesk: creditDesk,
    user: user,
    erc20: erc20,
  }

  return (
    <AppContext.Provider value={store}>
      <Router>
        <Header user={user} connectionComplete={setupWeb3}/>
        <div>
          <Switch>
            <Route exact path="/">
              <Borrow/>
            </Route>
            <Route path="/about">
              {/* <About /> */}
            </Route>
            <Route path="/earn">
              <Earn/>
            </Route>
          </Switch>
        </div>
        <Footer />
      </Router>
    </AppContext.Provider>
  )
}

export {
  App,
  AppContext,
}
