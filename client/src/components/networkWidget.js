import React, { useState } from 'react';
import _ from 'lodash';
import { croppedAddress, displayNumber } from '../utils';
import NetworkErrors from './networkErrors';
import iconCheck from '../images/check-sand.svg';

function NetworkWidget(props) {
  const [showNetworkWidgetInfo, setShowNetworkWidgetInfo] = useState('');

  function enableMetamask() {
    if (props.user.address) {
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
    // TODO: Implement this!
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

  let transactions = '';
  let enabledText = croppedAddress(props.user.address);
  let enabledClass = '';

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

  if (props.currentErrors.length > 0) {
    enabledClass = 'error';
    enabledText = 'Error';
  } else if (_.some(props.currentTXs, { status: 'pending' })) {
    const pendingTXCount = _.countBy(props.currentTXs, { status: 'pending' }).true;
    enabledClass = 'pending';
    enabledText = pendingTXCount === 1 ? 'Processing' : pendingTXCount + ' Processing';
  } else if (props.currentTXs.length > 0 && _.every(props.currentTXs, { status: 'successful' })) {
    enabledClass = 'success';
  }

  if (props.currentTXs.length > 0) {
    transactions = (
      <div className="network-widget-section">
        <div className="network-widget-header">
          Transactions<a href="/transactions">view all</a>
        </div>
        {_.reverse(props.currentTXs.map(transactionItem))}
      </div>
    );
  }

  const disabledNetworkWidget = (
    <div className="network-widget">
      <button className="network-widget-button" onClick={enableMetamask}>
        Connect Metamask
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
        <div className="success-indicator">
          <img className="icon" src={iconCheck} alt="check" />
          Success
        </div>
      </button>
      <div className="network-widget-info">
        <div className="network-widget-section address">{croppedAddress(props.user.address)}</div>
        <NetworkErrors currentErrors={props.currentErrors} />
        <div className="network-widget-section">
          USDC balance <span className="value">{displayNumber(props.user.usdcBalance, 2)}</span>
        </div>
        {transactions}
        <div className="network-widget-section">
          <button className="network-widget-disable-button" onClick={disableMetamask}>
            Disconnect Metamask
          </button>
        </div>
      </div>
    </div>
  );

  if (!props.user.address) {
    return disabledNetworkWidget;
  } else {
    return enabledNetworkWidget;
  }
}

export default NetworkWidget;
