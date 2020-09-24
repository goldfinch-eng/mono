import React, { useState } from 'react';
import _ from 'lodash';
import iconRedX from '../images/x-red.svg';
import { croppedAddress } from '../utils';

function NetworkWidget(props) {
  const [showNetworkWidgetInfo, setShowNetworkWidgetInfo] = useState('');

  function enableMetamask() {
    console.log('user is...', props.user);
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

  function disableMetamask() {
    props.setUser(false);
    setShowNetworkWidgetInfo('');
  }

  function toggleOpenWidget() {
    if (showNetworkWidgetInfo === '') {
      setShowNetworkWidgetInfo('open');
    } else {
      setShowNetworkWidgetInfo('');
    }
  }

  let errors = '';
  let transactions = '';
  let enabledText = croppedAddress(props.user);
  let enabledClass = '';

  function errorItem(tx) {
    return (
      <div key={tx.id} className="error-item">
        <div className="error-label">Error</div>
        <div className="dismiss-error-item">
          <img src={iconRedX} alt="x" />
        </div>
        <p>{tx.errorMessage}</p>
      </div>
    );
  }

  function transactionItem(tx) {
    return (
      <div key={tx.id} className={`transaction-item ${tx.status}`}>
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
        ${tx.amount} {tx.type}
      </div>
    );
  }

  const erroredTransactions = _.filter(props.currentTXs, { status: 'error' });
  if (erroredTransactions.length > 0) {
    enabledClass = 'error';
    enabledText = 'Error';
    errors = <div className="error-items">{erroredTransactions.map(errorItem)}</div>;
  } else if (_.some(props.currentTXs, { status: 'pending' })) {
    const pendingTXCount = _.countBy(props.currentTXs, { status: 'pending' }).true;
    enabledClass = 'pending';
    enabledText = pendingTXCount + ' Pending';
  } else if (props.currentTXs.length > 0 && _.every(props.currentTXs, { status: 'successful' })) {
    enabledText = 'Success';
  }

  if (props.currentTXs.length > 0) {
    transactions = (
      <div className="network-widget-section">
        <div className="network-widget-header">
          Transactions<a href="/transactions">view all</a>
        </div>
        {props.currentTXs.map(transactionItem)}
      </div>
    );
  }

  const disabledNetworkWidget = (
    <div className="network-widget">
      <button className="network-widget-button" onClick={enableMetamask}>
        Enable Metamask
      </button>
    </div>
  );

  const enabledNetworkWidget = (
    <div className={`network-widget ${showNetworkWidgetInfo}`}>
      <button className={`network-widget-button ${enabledClass}`} onClick={toggleOpenWidget}>
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
        {enabledText}
      </button>
      <div className="network-widget-info">
        <div className="network-widget-section address">{croppedAddress(props.user)}</div>
        {errors}
        <div className="network-widget-section">
          USDC balance <span className="value">0.00</span>
        </div>
        {transactions}
        <div className="network-widget-section">
          <button className="network-widget-disable-button" onClick={disableMetamask}>
            Disable Metamask
          </button>
        </div>
      </div>
    </div>
  );

  if (!props.user) {
    return disabledNetworkWidget;
  } else {
    return enabledNetworkWidget;
  }
}

export default NetworkWidget;
