import BN from 'bn.js';
import React, { useState, useContext, useEffect } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import CreditBarViz from './creditBarViz.js';
import CreditTerms from './creditTerms.js';
import PaymentStatus from './paymentStatus.js';
import web3 from '../web3.js';
import { buildCreditLine, fetchCreditLineData } from '../ethereum/creditLine.js';
import { AppContext } from '../App.js';
import { croppedAddress } from '../utils';

function Borrow(props) {
  const { creditDesk, erc20, pool, user } = useContext(AppContext);
  const [borrower, setBorrower] = useState({});
  const [creditLine, setCreditLine] = useState({});
  const [_creditLineFactory, setCreditLineFactory] = useState({});

  async function updateBorrowerAndCreditLine() {
    let creditLine = {};
    const [borrowerAddress] = await web3.eth.getAccounts();
    borrower.address = borrowerAddress;
    if (borrowerAddress) {
      const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrowerAddress).call();
      const allowance = new BN(await erc20.methods.allowance(borrowerAddress, pool._address).call());
      borrower.allowance = allowance;
      if (borrowerCreditLines.length) {
        const factory = buildCreditLine(borrowerCreditLines[0]);
        setCreditLineFactory(factory);
        creditLine = await fetchCreditLineData(factory);
      }
    }
    setBorrower(borrower);
    setCreditLine(creditLine);
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

  let paymentStatus = '';
  let creditLineInfo = '';
  let creditLineTitle = 'Credit Line';

  if (!user.address) {
    creditLineInfo = (
      <div className="content-empty-message background-container">
        You are not currently connected to Metamask. In order to borrow, you first need to connect to Metamask.
      </div>
    );
  } else if (!creditLine.address) {
    creditLineInfo = (
      <div className="content-empty-message background-container">
        You do not have any credit lines. In order to borrow, you first need a Goldfinch credit line. Then you can
        drawdown funds from the credit line.
      </div>
    );
  } else {
    creditLineTitle = `Credit Line / ${croppedAddress(creditLine.address)}`;
    paymentStatus = <PaymentStatus creditLine={creditLine} />;
    creditLineInfo = <CreditBarViz creditLine={creditLine} />;
  }

  return (
    <div className="content-section">
      <div className="page-header">{creditLineTitle}</div>
      {creditLineInfo}
      <CreditActionsContainer borrower={borrower} creditLine={creditLine} actionComplete={actionComplete} />
      {paymentStatus}
      <CreditTerms creditLine={creditLine} />
    </div>
  );
}

export default Borrow;
