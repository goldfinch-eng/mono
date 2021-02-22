import React, { useState, useContext, useEffect } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import CreditStatus from './creditStatus.js';
import ConnectionNotice from './connectionNotice.js';
import BorrowHeader from './borrowHeader';
import { buildCreditLine, fetchCreditLineData, defaultCreditLine } from '../ethereum/creditLine.js';
import { AppContext } from '../App.js';

function Borrow(props) {
  const { creditDesk, user } = useContext(AppContext);
  const [creditLines, setCreditLines] = useState([]);
  const [creditLine, setCreditLine] = useState(defaultCreditLine);

  async function updateBorrowerAndCreditLine() {
    const borrowerAddress = user.address;
    if (borrowerAddress && creditDesk.loaded) {
      const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrowerAddress).call();
      setCreditLines(borrowerCreditLines);
      if (borrowerCreditLines.length && !creditLine.loaded) {
        // Default to the most recent credit line
        changeCreditLine(borrowerCreditLines[borrowerCreditLines.length - 1]);
      } else {
        creditLine.loaded = true;
        setCreditLine({ ...creditLine });
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

  async function changeCreditLine(clAddress) {
    const instance = buildCreditLine(clAddress);
    setCreditLine(await fetchCreditLineData(instance));
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <BorrowHeader
          user={user}
          selectedCreditLine={creditLine}
          creditLines={creditLines}
          changeCreditLine={changeCreditLine}
        />
      </div>
      <ConnectionNotice creditLine={creditLine} />
      <CreditActionsContainer borrower={user} creditLine={creditLine} actionComplete={actionComplete} />
      <CreditStatus creditLine={creditLine} user={user} />
    </div>
  );
}

export default Borrow;
