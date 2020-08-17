import React from 'react';
import Web3Info from './components/Web3Info/index.js';
import Pool from './components/Pool/pool.js';
import pool from './components/Pool/instance.js';
import styles from './App.module.scss';
import PaymentStatus from './components/paymentStatus.js';
import CreditStatus from './components/creditStatus.js';
import CreditActionsContainer from './components/creditActionsContainer';
import Footer from "./components/footer";
import Header from "./components/header";
import Stuff from "./components/stuff";
import { useWeb3Injected, useWeb3Network } from '@openzeppelin/network/react';
const infuraToken = '95202223388e49f48b423ea50a70e336';

function App() {
  const injected = useWeb3Injected();
  const isHttp = window.location.protocol === 'http:';
  const local = useWeb3Network('http://127.0.0.1:8545');
  const network = useWeb3Network(`wss://ropsten.infura.io/ws/v3/${infuraToken}`, {
    pollInterval: 10 * 1000,
  });

  return (
    <>
      <Header />
      {/* <Stuff /> */}
      <CreditActionsContainer/>
      <PaymentStatus userId="5"/>
      <CreditStatus userId="5"/>
      {/* <InfoSection title="Payment Status"/> */}

      {/* <Pool instance={pool}></Pool> */}
      {/* <div className={styles.App}>
        {injected && <Web3Info title="Wallet Web3" web3Context={injected} />}
        {isHttp && <Web3Info title="Local Web3 Node" web3Context={local} />}
        {infuraToken && <Web3Info title="Infura Web3" web3Context={network} />}
      </div> */}
      <Footer />
    </>
  );
}

export default App;
