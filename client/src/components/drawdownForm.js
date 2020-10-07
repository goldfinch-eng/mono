import React, { useContext, useState, useEffect } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { fromAtomic, minimumNumber, toAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import TransactionForm from './transactionForm';
import { fetchPoolData } from '../ethereum/pool';

function DrawdownForm(props) {
  const { creditDesk, pool, erc20 } = useContext(AppContext);
  const [poolData, setPoolData] = useState({});

  useEffect(() => {
    (async () => {
      setPoolData(await fetchPoolData(pool, erc20));
    })();
  }, []);

  function makeDrawdown(value) {
    const drawdownAmount = toAtomic(value);
    return sendFromUser(
      creditDesk.methods.drawdown(drawdownAmount, props.creditLine.address),
      props.borrower.address,
    ).then(result => {
      props.closeForm();
      props.actionComplete();
    });
  }

  return (
    <TransactionForm
      navOptions={[{ label: 'Drawdown', value: 'drawdown', submitTransaction: makeDrawdown }]}
      closeForm={props.closeForm}
      maxAmount={minimumNumber(fromAtomic(props.creditLine.availableBalance), fromAtomic(poolData.balance))}
    />
  );
}

export default DrawdownForm;
