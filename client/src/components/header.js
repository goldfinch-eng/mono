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

  let transactions = null;
  if (_.some(props.currentTXs, {status: "pending"})) {
    const pendingTXCount = _.countBy(props.currentTXs, {status: "pending"}).true;
    console.log("Pending TX Count is..", pendingTXCount);
    transactions = (
      <div className="header-widget">
        <div class="spinner">
          <div class="double-bounce1"></div>
          <div class="double-bounce2"></div>
        </div>
        {pendingTXCount} Pending
      </div>
    )

  } else if (props.currentTXs.length > 0 && _.every(props.currentTXs, {status: "successful"})) {
    transactions = (
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
      {transactions}
      <nav>
        <NavLink to="/" exact={true}>Borrow</NavLink>
        <NavLink to="/earn">Earn</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
    </div>
  )
}

export default Header;
