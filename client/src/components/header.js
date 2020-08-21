import React from "react";
import { NavLink } from 'react-router-dom';
import logoPurp from "../images/logomark-purp.svg";

function Header() {
  return (
    <div className="header">
      <img className="header-logo" src={logoPurp} alt="Goldfinch" />
      <nav>
        <NavLink to="/">Borrow</NavLink>
        <NavLink to="/earn">Earn</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      {/* <button onClick={() => { console.log("heyyy, trying to request stuff.."); window.ethereum.request({ method: 'eth_requestAccounts' }); }} className="enableEthereumButton">Enable Ethereum</button> */}
      <a className="connect-wallet">Connected</a>
    </div>
  );
}

export default Header;
