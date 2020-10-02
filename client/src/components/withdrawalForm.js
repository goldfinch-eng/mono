import React, { useContext } from 'react';
import { fromAtomic, minimumNumber, toAtomic } from '../ethereum/erc20';
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

  let availableAmount = fromAtomic(props.capitalProvider.availableToWithdrawal);
  const balance = displayDollars(availableAmount);
  const message = `Withdrawal funds from the pool. You have have ${balance} available to withdraw.`;

  return (
    <TransactionForm
      navOptions={[{ label: 'Withdrawal', value: 'withdrawal', message: message, submitTransaction: action }]}
      closeForm={props.closeForm}
      maxAmount={minimumNumber(availableAmount, fromAtomic(props.poolData.balance))}
    />
  );
}

export default WithdrawalForm;
