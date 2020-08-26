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

function App() {
  const [connected, setConnected] = useState(undefined);
  async function checkForAccounts() {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length > 0) {
      setConnected(true);
    }
  }
  useEffect(() => {
    checkForAccounts();
  }, []);

  return (
    <Router>
      <Header connected={connected} connectionComplete={checkForAccounts}/>
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
  )
}

export default App;
