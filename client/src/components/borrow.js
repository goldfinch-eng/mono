import BN from 'bn.js';
import React, { useState, useContext, useEffect } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import CreditStatus from './creditStatus.js';
import UnlockUSDCForm from './unlockUSDCForm.js';
import web3 from '../web3.js';
import { buildCreditLine, fetchCreditLineData, defaultCreditLine } from '../ethereum/creditLine.js';
import { AppContext } from '../App.js';
import { croppedAddress } from '../utils';

function Borrow(props) {
  const { creditDesk, erc20, pool, user } = useContext(AppContext);
  const [borrower, setBorrower] = useState({});
  const [creditLine, setCreditLine] = useState(defaultCreditLine);
  const [creditLineFactory, setCreditLineFactory] = useState({});

  async function updateBorrowerAndCreditLine() {
    const [borrowerAddress] = await web3.eth.getAccounts();
    borrower.address = borrowerAddress;
    if (borrowerAddress) {
      const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrowerAddress).call();
      const allowance = new BN(await erc20.methods.allowance(borrowerAddress, pool._address).call());
      borrower.allowance = allowance;
      if (borrowerCreditLines.length) {
        const factory = buildCreditLine(borrowerCreditLines[0]);
        setCreditLineFactory(factory);
        setCreditLine(await fetchCreditLineData(factory));
      }
    }
    setBorrower(borrower);
  }

  useEffect(() => {
    if (!creditDesk) {
      return;
    }
    updateBorrowerAndCreditLine();
  }, [creditDesk]);

  async function actionComplete() {
    return updateBorrowerAndCreditLine();
  }

  let notice = '';
  let creditLineTitle = 'Credit Line';
  if (!user.address) {
    notice = (
      <div className="content-empty-message background-container">
        You are not currently connected to Metamask. In order to borrow, you first need to connect to Metamask.
      </div>
    );
  } else if (!creditLine.address) {
    notice = (
      <div className="content-empty-message background-container">
        You do not have any credit lines. In order to borrow, you first need a Goldfinch credit line. Then you can
        drawdown funds from the credit line.
      </div>
    );
  } else if (!user.usdcIsUnlocked) {
    notice = <UnlockUSDCForm />;
  } else {
    creditLineTitle = `Credit Line / ${croppedAddress(creditLine.address)}`;
  }

  return (
    <div className="content-section">
      <div className="page-header">{creditLineTitle}</div>
      {notice}
      <CreditActionsContainer borrower={borrower} creditLine={creditLine} actionComplete={actionComplete} />
      <CreditStatus creditLine={creditLine} user={user} />
    </div>
  );
}

export default Borrow;
