import React from "react";
import _ from "lodash"
import { NavLink } from 'react-router-dom';
import logoPurp from "../images/logomark-purp.svg";

function Header(props) {
  function enableMetamask() {
    if (props.user) {
      return;
    }
    window.ethereum.request({ method: 'eth_requestAccounts' }).then((_result) => {
      props.connectionComplete();
    }).catch((error) => {
      console.log("Error connecting to metamask", error);
    });
  }

  let walletButtonText;
  if (!props.user) {
    walletButtonText = "Enable Metamask"
  } else {
    walletButtonText = "Connected"
  }

  let walletButton = <a onClick={enableMetamask} className="connect-wallet">{walletButtonText}</a>

  let pendingTransactions = null;
  if (_.some(props.pendingTXs, {status: "pending"})) {
    pendingTransactions = (
      <div className="loading-transactions">
        <div className="loading-container">
          <div className="lds-hourglass"></div>
          <div className="loading-text">
            {props.pendingTXs.length} Pending ✓
          </div>
        </div>
      </div>
    )
  } else if (props.pendingTXs.length > 0 && _.every(props.pendingTXs, {status: "successful"})) {
    pendingTransactions = (
      <div className="loading-transactions fade-out">
        <div className="successful-transactions-container">
          <span className="successful-transactions">✓</span>
          <div className="loading-text">
            Success
          </div>
        </div>
      </div>
    )
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
      {pendingTransactions}
    </div>
  )
}

export default Header;
