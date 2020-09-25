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
  const { creditDesk, erc20, pool } = useContext(AppContext);
  const [borrower, setBorrower] = useState({});
  const [creditLine, setCreditLine] = useState({});
  const [creditLineFadtory, setCreditLineFactory] = useState({});

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
    updateBorrowerAndCreditLine();
  }

  if (!creditLine.address) {
    return (
      <div className="content-section">
        <div className="page-header">Credit Line</div>
        <div className="content-empty-message">
          You do not have any credit lines. In order to borrow, you first need a Goldfinch credit line. Then you can
          drawdown funds from the credit line.
        </div>
        <CreditActionsContainer borrower={borrower} creditLine={creditLine} actionComplete={actionComplete} />
        <CreditTerms creditLine={creditLine} />
      </div>
    );
  } else {
    return (
      <div className="content-section">
        <div className="page-header">Credit Line / {croppedAddress(creditLine.address)}</div>
        <CreditBarViz creditLine={creditLine} />
        <CreditActionsContainer borrower={borrower} creditLine={creditLine} actionComplete={actionComplete} />
        <PaymentStatus creditLine={creditLine} />
        <CreditTerms creditLine={creditLine} />
      </div>
    );
  }
}

export default Borrow;
