import React from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
} from "react-router-dom";

import Borrow from './components/borrow.js';
import Earn from './components/earn.js';
import Footer from "./components/footer";
import Header from "./components/header";
// import Web3Info from './components/Web3Info/index.js';
// import Pool from './components/Pool/pool.js';
// import pool from './components/Pool/instance.js';
// import styles from './App.module.scss';
// import Stuff from "./components/stuff";
// import { useWeb3Injected, useWeb3Network } from '@openzeppelin/network/react';
// const infuraToken = '95202223388e49f48b423ea50a70e336';

function App() {
  // const injected = useWeb3Injected();
  // const isHttp = window.location.protocol === 'http:';
  // const local = useWeb3Network('http://127.0.0.1:8545');
  // const network = useWeb3Network(`wss://ropsten.infura.io/ws/v3/${infuraToken}`, {
  //   pollInterval: 10 * 1000,
  // });

  return (
    <>
      <Router>
        <Header/>
        <div>
          {/* <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/about">About</Link>
            </li>
            <li>
              <Link to="/dashboard">Dashboard</Link>
            </li>
          </ul> */}

          {/* <hr /> */}

          {/*
            A <Switch> looks through all its children <Route>
            elements and renders the first one whose path
            matches the current URL. Use a <Switch> any time
            you have multiple routes, but you want only one
            of them to render at a time
          */}
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

      {/* <Pool instance={pool}></Pool> */}
      {/* <div className={styles.App}>
        {injected && <Web3Info title="Wallet Web3" web3Context={injected} />}
        {isHttp && <Web3Info title="Local Web3 Node" web3Context={local} />}
        {infuraToken && <Web3Info title="Infura Web3" web3Context={network} />}
      </div> */}
    </>
  );
}

export default App;
