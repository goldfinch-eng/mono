import React from 'react';
import _ from 'lodash';
import web3 from '../web3';
import { croppedAddress, displayNumber } from '../utils';
import { CONFIRMATION_THRESHOLD } from '../ethereum/utils';
import useCloseOnClickOrEsc from '../hooks/useCloseOnClickOrEsc';
import NetworkErrors from './networkErrors';
import { iconCheck, iconOutArrow } from './icons.js';
import { usdcFromAtomic } from '../ethereum/erc20';

function NetworkWidget(props) {
  const [node, showNetworkWidgetInfo, setShowNetworkWidgetInfo] = useCloseOnClickOrEsc();

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
        console.error('Error connecting to metamask', error);
      });
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
  let userAddressForDisplay = croppedAddress(props.user.address);
  let enabledClass = '';

  function transactionItem(tx) {
    const transactionlabel = tx.name === 'Approval' ? tx.name : `$${tx.amount} ${tx.name}`;
    let etherscanSubdomain;
    if (props.network.name === 'mainnet') {
      etherscanSubdomain = '';
    } else {
      etherscanSubdomain = `${props.network}.`;
    }

    let confirmationMessage = '';
    if (tx.status === 'pending') {
      confirmationMessage = (
        <span>
          {`${tx.confirmations} / ${CONFIRMATION_THRESHOLD}`}
          <span className="small-network-message">&nbsp; conf.</span>
        </span>
      );
    }

    if (tx.status === 'awaiting_consensus') {
      confirmationMessage = (
        <span>
          <span className="small-network-message">Awaiting consensus</span>
        </span>
      );
    }

    return (
      <div key={tx.id} className={`transaction-item ${tx.status}`}>
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
        {transactionlabel}&nbsp;
        <a
          className="transaction-link"
          href={`https://${etherscanSubdomain}etherscan.io/tx/${tx.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {iconOutArrow}
        </a>
        {confirmationMessage}
      </div>
    );
  }

  if (props.currentErrors.length > 0) {
    enabledClass = 'error';
    enabledText = 'Error';
  } else if (_.some(props.currentTXs, { status: 'awaiting_consensus' })) {
    enabledClass = 'pending';
    enabledText = 'Awaiting consensus';
  } else if (_.some(props.currentTXs, { status: 'pending' })) {
    const pendingTXCount = _.countBy(props.currentTXs, { status: 'pending' }).true;
    const confirmingCount = _.countBy(props.currentTXs, item => {
      return item.status === 'pending' && item.confirmations > 0;
    }).true;
    enabledClass = 'pending';
    if (confirmingCount > 0) {
      enabledText = 'Confirming';
    } else if (pendingTXCount > 0) {
      enabledText = pendingTXCount === 1 ? 'Processing' : pendingTXCount + ' Processing';
    }
  } else if (props.currentTXs.length > 0 && _.every(props.currentTXs, { status: 'successful' })) {
    enabledClass = 'success';
  }

  let allTx = _.compact(_.concat(props.currentTXs, _.slice(props.user.pastTXs, 0, 5)));
  allTx = _.uniqBy(allTx, 'id');
  if (allTx.length > 0) {
    transactions = (
      <div className="network-widget-section">
        <div className="network-widget-header">
          Recent Transactions
          <a href="/transactions">view all</a>
        </div>
        {allTx.map(transactionItem)}
      </div>
    );
  }

  if (props.gnosisSafeInfo) {
    userAddressForDisplay = `${enabledText} (Gnosis Safe)`;
  }

  const connectMetamaskNetworkWidget = (
    <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
      <button className="network-widget-button bold" onClick={toggleOpenWidget}>
        Connect Metamask
      </button>
      <div className="network-widget-info">
        <div className="network-widget-section">
          <div className="agree-to-terms">
            <p>By connecting:</p>
            <p className="agree-item">
              I accept the Goldfinch <a href="/terms">Terms of Service</a>.
            </p>
            <p className="agree-item">
              If I deposit into the pool, I confirm I am an Accredited Investor under{' '}
              <a href="https://www.ecfr.gov/cgi-bin/retrieveECFR?gp=&SID=8edfd12967d69c024485029d968ee737&r=SECTION&n=17y3.0.1.1.12.0.46.176">
                SEC Rule 501
              </a>
              .
            </p>
          </div>
          <button className="button bold" onClick={enableMetamask}>
            Connect Metamask
          </button>
        </div>
      </div>
    </div>
  );

  const enabledNetworkWidget = (
    <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
      <button className={`network-widget-button ${enabledClass}`} onClick={toggleOpenWidget}>
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
        {enabledText}
        <div className="success-indicator">{iconCheck}Success</div>
      </button>
      <div className="network-widget-info">
        <div className="network-widget-section address">{userAddressForDisplay}</div>
        <NetworkErrors currentErrors={props.currentErrors} />
        <div className="network-widget-section">
          USDC balance <span className="value">{displayNumber(usdcFromAtomic(props.user.usdcBalance), 2)}</span>
        </div>
        {transactions}
      </div>
    </div>
  );

  if (!window.ethereum) {
    return (
      <div ref={node} className="network-widget">
        <a href="https://metamask.io" className="network-widget-button bold">
          Go to metamask.io
        </a>
      </div>
    );
  } else if (!props.user.loaded) {
    return (
      <div ref={node} className="network-widget">
        <div className="network-widget-button">
          <div className="status-icon">
            <div className="indicator"></div>
          </div>
          Loading...
        </div>
      </div>
    );
  } else if (web3 && props.network.name && !props.network.supported) {
    return (
      <div ref={node} className="network-widget">
        <div className="network-widget-button disabled">Wrong Network</div>
      </div>
    );
  } else if (!props.user.address) {
    return connectMetamaskNetworkWidget;
  } else {
    return enabledNetworkWidget;
  }
}

export default NetworkWidget;
