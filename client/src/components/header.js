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

  let walletButton = <a onClick={enableMetamask} className="header-widget clickable">{walletButtonText}</a>

  let pendingTransactions = null;
  if (_.some(props.pendingTXs, {status: "pending"})) {
    pendingTransactions = (
      <div className="header-widget">
        <div class="spinner">
          <div class="double-bounce1"></div>
          <div class="double-bounce2"></div>
        </div>
        {props.pendingTXs.length} Pending
      </div>
      )
  } else if (props.pendingTXs.length > 0 && _.every(props.pendingTXs, {status: "successful"})) {
    pendingTransactions = (
      <div className="header-widget fade-out">
        <span className="icon">✓</span>
        Success
      </div>
    )
  }
  return (
    <div className="header">
      <img className="header-logo" src={logoPurp} alt="Goldfinch" />
      {walletButton}
      {pendingTransactions}
      <nav>
        <NavLink to="/">Borrow</NavLink>
        <NavLink to="/earn">Earn</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
    </div>
  )
}

export default Header;
