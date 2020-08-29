import React, { useState, useContext, useEffect } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import PaymentStatus from './paymentStatus.js';
import CreditStatus from './creditStatus.js';
import web3 from '../web3.js';
import { buildCreditLine } from '../ethereum/creditLine.js';
import { AppContext } from '../App.js';

function Borrow(props) {
  const { creditDesk } = useContext(AppContext);
  const [borrower, setBorrower] = useState('');
  const [creditLine, setCreditLine] = useState({});

  useEffect(() => {
    if (!creditDesk) {
      return;
    }
    async function updateBorrowerAndCreditLine() {
      let creditLine = {};
      const [borrower] = await web3.eth.getAccounts();
      if (borrower) {
        const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrower).call();
        if (borrowerCreditLines.length) {
          creditLine = buildCreditLine(borrowerCreditLines[0]);
        }
      }
      setBorrower(borrower);
      setCreditLine(creditLine);
    }
    updateBorrowerAndCreditLine();
  }, [borrower, creditLine, creditDesk])


  function actionComplete() {
    setBorrower(borrower);
    setCreditLine(creditLine);
  }

  return (
    <div>
      <div className="content-header">Your Credit Line</div>
      <CreditActionsContainer borrower={borrower} creditLine={creditLine} actionComplete={actionComplete}/>
      <PaymentStatus creditLine={creditLine}/>
      <CreditStatus creditLine={creditLine}/>
    </div>
  )
}

export default Borrow;