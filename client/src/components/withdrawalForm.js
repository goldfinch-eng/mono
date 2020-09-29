import React, { useContext } from 'react';
import { fromAtomic, toAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils.js';
import { displayDollars } from '../utils';
import { AppContext } from '../App.js';
import TransactionForm from './transactionForm';

function WithdrawalForm(props) {
  const { pool } = useContext(AppContext);

  async function action(value) {
    const withdrawalAmount = toAtomic(value);
    return sendFromUser(pool.methods.withdraw(withdrawalAmount), props.capitalProvider.address).then(result => {
      props.closeForm();
      props.actionComplete();
    });
  }

  const balance = displayDollars(fromAtomic(props.capitalProvider.availableToWithdrawal));
  const message = `Withdrawal funds from the pool. You have have ${balance} available to withdraw.`;

  return (
    <TransactionForm
      navOptions={[{ label: 'Withdrawal', value: 'withdrawal', message: message, submitTransaction: action }]}
      closeForm={props.closeForm}
    />
  );
}

export default WithdrawalForm;
