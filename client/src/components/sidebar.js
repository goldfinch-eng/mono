import React from 'react';
import { NavLink } from 'react-router-dom';
import useCloseOnClickOrEsc from '../hooks/useCloseOnClickOrEsc';
import logoPurp from '../images/logomark-purp.svg';
import { iconMenu } from './icons.js';

function Sidebar(props) {
  const [node, showSidebar, setShowSidebar] = useCloseOnClickOrEsc();

  function toggleSidebar() {
    if (showSidebar === '') {
      setShowSidebar('open');
    } else {
      setShowSidebar('');
    }
  }

  return (
    <div ref={node} className={`sidebar ${showSidebar}`}>
      <button className="open-sidebar" onClick={toggleSidebar}>
        {iconMenu}
      </button>
      <img className="sidebar-logo" src={logoPurp} alt="Goldfinch" />
      <nav>
        <NavLink to="/" exact={true}>
          Borrow
        </NavLink>
        <NavLink to="/earn">Earn</NavLink>
        <NavLink to="/transactions">Transactions</NavLink>
      </nav>
    </div>
  );
}

export default Sidebar;
