import React from "react";
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
