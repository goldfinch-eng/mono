import React, { useContext, useState, useEffect } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import TransactionForm from './transactionForm';
import { fetchPoolData } from '../ethereum/pool';
import { displayDollars } from '../utils';

function DrawdownForm(props) {
  const { creditDesk, pool, erc20 } = useContext(AppContext);
  const [poolData, setPoolData] = useState({});

  useEffect(() => {
    (async () => {
      setPoolData(await fetchPoolData(pool, erc20));
    })();
  }, []);

  function makeDrawdown({ value, sendToAddress }) {
    const drawdownAmount = usdcToAtomic(value);
    sendToAddress = sendToAddress === '' ? props.borrower.address : sendToAddress;
    return creditDesk.methods.drawdown(drawdownAmount, props.creditLine.address, sendToAddress);
  }

  function actionComplete() {
    props.closeForm();
    props.actionComplete();
  }

  const creditLineBalance = usdcFromAtomic(props.creditLine.availableCredit);
  const maxAmount = minimumNumber(creditLineBalance, usdcFromAtomic(poolData.balance));

  return (
    <TransactionForm
      title="Drawdown"
      headerMessage={`Available to drawdown: ${displayDollars(creditLineBalance)}`}
      sendToAddressForm={true}
      submitTransaction={makeDrawdown}
      actionComplete={actionComplete}
      closeForm={props.closeForm}
      maxAmount={maxAmount}
    />
  );
}

export default DrawdownForm;
