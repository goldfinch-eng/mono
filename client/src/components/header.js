import React from "react";
import logoPurp from "../images/logomark-purp.svg";

function Header() {
  return (
    <div className="header">
      <img className="header-logo" src={logoPurp} alt="Goldfinch" />
      <nav>
        <a class="selected">Borrow</a>
        <a>Deposit</a>
        <a>About</a>
      </nav>
      <a class="connect-wallet">Connected</a>
    </div>
  );
}

export default Header;