import React from 'react';
import Web3 from 'web3';
import { useWeb3Injected, useWeb3Network } from '@openzeppelin/network/react';
import Web3Info from './components/Web3Info/index.js';
import Pool from './components/Pool/pool.js';
import * as PoolContract from '../../artifacts/Pool.json';
import styles from './App.module.scss';

const infuraToken = '95202223388e49f48b423ea50a70e336';

function App() {
  console.log("The given provider is..", Web3.givenProvider);
  console.log("Pool is...", PoolContract);
  console.log("Pool abi is...", PoolContract.abi);
  let web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
  console.log("Web 3 is...", web3);
  const pool = new web3.eth.Contract(PoolContract.abi, "0x2AdAc39Ed0B1817acCB57349253AbAf7eE55560a");
  console.log("instantiated pool is..", pool);
  const injected = useWeb3Injected();
  const isHttp = window.location.protocol === 'http:';
  const local = useWeb3Network('http://127.0.0.1:8545');
  const network = useWeb3Network(`wss://ropsten.infura.io/ws/v3/${infuraToken}`, {
    pollInterval: 10 * 1000,
  });

  return (
    <>
      <h1>Goldfinch</h1>
      <Pool instance={pool}></Pool>
      <div className={styles.App}>
        {injected && <Web3Info title="Wallet Web3" web3Context={injected} />}
        {isHttp && <Web3Info title="Local Web3 Node" web3Context={local} />}
        {infuraToken && <Web3Info title="Infura Web3" web3Context={network} />}
      </div>
    </>
  );
}

export default App;
