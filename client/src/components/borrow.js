import BN from 'bn.js';
import React, { useState, useContext, useEffect } from 'react';
import CreditActionsContainer from './creditActionsContainer.js';
import CreditStatus from './creditStatus.js';
import ConnectionNotice from './connectionNotice.js';
import web3 from '../web3.js';
import { buildCreditLine, fetchCreditLineData, defaultCreditLine } from '../ethereum/creditLine.js';
import { AppContext } from '../App.js';
import { croppedAddress } from '../utils';

function Borrow(props) {
  const { creditDesk, erc20, pool, user } = useContext(AppContext);
  const [borrower, setBorrower] = useState({});
  const [creditLine, setCreditLine] = useState(defaultCreditLine);

  async function updateBorrowerAndCreditLine() {
    const borrowerAddress = user.address;
    borrower.address = user.address;
    if (borrowerAddress && creditDesk.loaded) {
      const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrowerAddress).call();
      const allowance = new BN(await erc20.methods.allowance(borrowerAddress, pool._address).call());
      borrower.allowance = allowance;
      if (borrowerCreditLines.length) {
        // Always use the last credit line, under the assumption for now that the last one is your
        // active one. If we start legit having multiple active credit lines, then we'll need to change
        // the front-end
        const instance = buildCreditLine(borrowerCreditLines[borrowerCreditLines.length - 1]);
        setCreditLine(await fetchCreditLineData(instance));
      } else {
        creditLine.loaded = true;
        setCreditLine({ ...creditLine });
      }
    }
    setBorrower(borrower);
  }

  useEffect(() => {
    if (!creditDesk) {
      return;
    }
    updateBorrowerAndCreditLine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditDesk, user]);

  async function actionComplete() {
    return updateBorrowerAndCreditLine();
  }

  let creditLineTitle = 'Loading...';
  if (user.loaded && creditLine.address) {
    creditLineTitle = `Credit Line / ${croppedAddress(creditLine.address)}`;
  } else if (user.loaded) {
    creditLineTitle = 'Credit Line';
  }

  return (
    <div className="content-section">
      <div className="page-header">{creditLineTitle}</div>
      <ConnectionNotice creditLine={creditLine} />
      <CreditActionsContainer borrower={borrower} creditLine={creditLine} actionComplete={actionComplete} />
      <CreditStatus creditLine={creditLine} user={user} />
    </div>
  );
}

export default Borrow;
