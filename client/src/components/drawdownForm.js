import React, { useContext, useState, useEffect } from 'react';
import { sendFromUser } from '../ethereum/utils';
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
    return sendFromUser(
      creditDesk.methods.drawdown(drawdownAmount, props.creditLine.address, sendToAddress),
      props.borrower.address,
    ).then(result => {
      props.closeForm();
      props.actionComplete();
    });
  }

  const maxAmount = minimumNumber(usdcFromAtomic(props.creditLine.availableBalance), usdcFromAtomic(poolData.balance));

  return (
    <TransactionForm
      title="Drawdown"
      headerMessage={`Available to drawdown: ${displayDollars(maxAmount)}`}
      sendToAddressForm={true}
      submitTransaction={makeDrawdown}
      closeForm={props.closeForm}
      maxAmount={maxAmount}
    />
  );
}

export default DrawdownForm;
