import React, { useState } from "react";
import { NavLink } from 'react-router-dom';
import logoPurp from "../images/logomark-purp.svg";

function Header(props) {
  function enableMetamask() {
    window.ethereum.request({ method: 'eth_requestAccounts' }).then((_result) => {
      props.connectionComplete();
    }).catch((error) => {
      console.log("Error connecting to metamask", error);
    });
  }

  let walletButton;
  if (props.connected === undefined) {
    walletButton = null;
  } else if (props.connected === false) {
    walletButton = <a onClick={enableMetamask} className="connect-wallet">Enable Metamask</a>
  } else {
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
}

export default Header;
