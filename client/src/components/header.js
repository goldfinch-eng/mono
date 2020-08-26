import React from "react";
import { NavLink } from 'react-router-dom';
import logoPurp from "../images/logomark-purp.svg";
import { DrizzleContext } from "@drizzle/react-plugin";
import _ from "lodash";

function Header() {
  let walletButton = <a className="connect-wallet">Connect your Wallet</a>;
  if (window.ethereum !== 'undefined' && !window.ethereum.selectedAddress) {
    walletButton = <a onClick={() => { window.ethereum.request({ method: 'eth_requestAccounts' }); }} className="connect-wallet">Enable Metamask</a>
  } else if (window.ethereum !== 'undefined' && window.ethereum.selectedAddress) {
    walletButton = <a className="connect-wallet">Connected</a>
  }
  return (
      <div className="header">
        <img className="header-logo" src={logoPurp} alt="Goldfinch" />
        <nav>
          <NavLink to="/">Borrow</NavLink>
          <NavLink to="/earn">Earn</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        {walletButton}
      </div>
    )

  return (
    <DrizzleContext.Consumer>
      {drizzleContext => {
        const { drizzle, drizzleState, initialized } = drizzleContext;
        // Note, this only sort of works for now. I need to figure out better state management
        // for wallets.
        let walletButton = <a className="connect-wallet">Connect your Wallet</a>;
        if (initialized && _.isEmpty(drizzleState.accounts)) {
          walletButton = <a onClick={() => { console.log("I'm calling the enable function!"); window.ethereum.request({ method: 'eth_requestAccounts' }); }} className="connect-wallet">Enable Metamask</a>
        } else if (initialized && !_.isEmpty(drizzleState.accounts)) {
          walletButton = <a className="connect-wallet">Connected</a>
        }

        console.log("Drizzle is..", drizzle);
        console.log("drizzleState is..", drizzleState);
        console.log("initalized is..", initialized);
        if (!initialized) {
          return "Loading...";
        }
        return (
          <div className="header">
            <img className="header-logo" src={logoPurp} alt="Goldfinch" />
            <nav>
              <NavLink to="/">Borrow</NavLink>
              <NavLink to="/earn">Earn</NavLink>
              <NavLink to="/about">About</NavLink>
            </nav>
            {walletButton}
          </div>
        )
      }}
    </DrizzleContext.Consumer>
  );
}

export default Header;
