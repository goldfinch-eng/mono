import React from 'react';
import _ from 'lodash';

function Header(props) {
  function enableMetamask() {
    if (props.user) {
      return;
    }
    window.ethereum
      .request({ method: 'eth_requestAccounts' })
      .then(_result => {
        props.connectionComplete();
      })
      .catch(error => {
        console.log('Error connecting to metamask', error);
      });
  }

  let walletButtonText;
  if (!props.user) {
    walletButtonText = 'Enable Metamask';
  } else {
    walletButtonText = 'Connected';
  }

  let walletButton = (
    <button onClick={enableMetamask} className="header-widget clickable">
      {walletButtonText}
    </button>
  );

  let transactions = null;
  if (_.some(props.currentTXs, { status: 'pending' })) {
    const pendingTXCount = _.countBy(props.currentTXs, { status: 'pending' }).true;
    console.log('Pending TX Count is..', pendingTXCount);
    transactions = (
      <div className="header-widget">
        <div className="spinner">
          <div className="double-bounce1"></div>
          <div className="double-bounce2"></div>
        </div>
        {pendingTXCount} Pending
      </div>
    );
  } else if (props.currentTXs.length > 0 && _.every(props.currentTXs, { status: 'successful' })) {
    transactions = (
      <div className="header-widget fade-out">
        <span className="icon">✓</span>
        Success
      </div>
    );
  }
  return (
    <div className="header">
      {walletButton}
      {transactions}
    </div>
  );
}

export default Header;
