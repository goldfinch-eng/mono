import React from "react";
import { NavLink } from 'react-router-dom';
import logoPurp from "../images/logomark-purp.svg";

function Header() {
  // Note, this only sort of works for now. I need to figure out better state management
  // for wallets.
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
  );
}

export default Header;
