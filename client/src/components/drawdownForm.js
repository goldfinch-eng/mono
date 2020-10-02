import React, { useContext } from 'react';
import { sendFromUser } from '../ethereum/utils';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import TransactionForm from './transactionForm';

function DrawdownForm(props) {
  const { creditDesk } = useContext(AppContext);

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
      maxAmount={fromAtomic(props.creditLine.availableBalance)}
    />
  );
}

export default DrawdownForm;
