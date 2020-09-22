import React from 'react';
import { NavLink } from 'react-router-dom';
import logoPurp from '../images/logomark-purp.svg';

function Sidebar(props) {
  return (
    <div className="sidebar">
      <img className="sidebar-logo" src={logoPurp} alt="Goldfinch" />
      <nav>
        <NavLink to="/" exact={true}>
          Borrow
        </NavLink>
        <NavLink to="/earn">Earn</NavLink>
      </nav>
    </div>
  );
}

export default Sidebar;
