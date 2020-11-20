import React, { useContext } from 'react';
import { AppContext } from '../App.js';
import web3 from '../web3';
import UnlockUSDCForm from './unlockUSDCForm.js';

function ConnectionNotice(props) {
  const { network, user } = useContext(AppContext);
  let notice = '';

  if (!window.ethereum) {
    notice = (
      <div className="content-empty-message background-container">
        In order to use Goldfinch, you'll first need to download and install the Metamask plug-in from{' '}
        <a href="https://metamask.io/">metamask.io</a>.
      </div>
    );
  } else if (web3 && !network) {
    notice = (
      <div className="content-empty-message background-container">
        It looks like you aren't on the right Ethereum network. To use Goldfinch, you should connect to Ethereum Mainnet
        from Metamask.
      </div>
    );
  } else if (!user.address) {
    notice = (
      <div className="content-empty-message background-container">
        You are not currently connected to Metamask. To use Goldfinch, you first need to connect to Metamask.
      </div>
    );
  } else if (props.creditLine && !props.creditLine.address) {
    notice = (
      <div className="content-empty-message background-container">
        You do not have any credit lines. In order to borrow, you first need a Goldfinch credit line. Then you can
        drawdown funds from the credit line.
      </div>
    );
  } else if (!user.usdcIsUnlocked) {
    notice = <UnlockUSDCForm />;
  }

  return notice;
}

export default ConnectionNotice;
