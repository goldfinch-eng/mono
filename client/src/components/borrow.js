import React, { useState, useContext, useEffect } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import CreditActionsMultipleContainer from './creditActionsMultipleContainer';
import CreditStatus from './creditStatus.js';
import ConnectionNotice from './connectionNotice.js';
import BorrowHeader from './borrowHeader';
import { fetchCreditLineData, defaultCreditLine } from '../ethereum/creditLine.js';
import { AppContext } from '../App.js';
import CreditLinesList from './creditLinesList';

function Borrow(props) {
  const { creditDesk, user, usdc } = useContext(AppContext);
  const [creditLinesAddresses, setCreditLinesAddresses] = useState([]);
  const [creditLine, setCreditLine] = useState(defaultCreditLine);

  async function updateBorrowerAndCreditLine() {
    const borrower = user.borrower;
    if (borrower && creditDesk.loaded) {
      const borrowerCreditLines = borrower.creditLinesAddresses;
      setCreditLinesAddresses(borrowerCreditLines);
      if (borrowerCreditLines.length && !creditLine.loaded) {
        changeCreditLine(borrowerCreditLines);
      }
    }
  }

  useEffect(() => {
    if (!creditDesk) {
      return;
    }
    updateBorrowerAndCreditLine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditDesk, user]);

  async function actionComplete() {
    return changeCreditLine(creditLine.address);
  }

  async function changeCreditLine(clAddresses) {
    setCreditLine(await fetchCreditLineData(clAddresses, usdc));
  }

  let creditActionsContainer;
  let creditLineStatus;
  if (creditLine.isMultiple) {
    creditActionsContainer = (
      <CreditActionsMultipleContainer
        borrower={user.borrower}
        creditLine={creditLine}
        actionComplete={actionComplete}
      />
    );
    creditLineStatus = <CreditLinesList creditLine={creditLine} user={user} changeCreditLine={changeCreditLine} />;
  } else {
    creditActionsContainer = (
      <CreditActionsContainer borrower={user.borrower} creditLine={creditLine} actionComplete={actionComplete} />
    );
    creditLineStatus = <CreditStatus creditLine={creditLine} user={user} />;
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <BorrowHeader
          user={user}
          selectedCreditLine={creditLine}
          creditLinesAddresses={creditLinesAddresses}
          changeCreditLine={changeCreditLine}
        />
      </div>
      <ConnectionNotice creditLine={creditLine} />
      {creditActionsContainer}
      {creditLineStatus}
    </div>
  );
}

export default Borrow;
