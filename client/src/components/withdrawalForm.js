import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { fiduFromAtomic } from '../ethereum/fidu';
import { sendFromUser } from '../ethereum/utils.js';
import { displayDollars } from '../utils';
import { AppContext } from '../App.js';
import TransactionForm from './transactionForm';

function WithdrawalForm(props) {
  const { pool } = useContext(AppContext);

  async function action({ value }) {
    const withdrawalAmount = usdcToAtomic(value);
    return sendFromUser(pool.methods.withdraw(withdrawalAmount), props.capitalProvider.address).then(result => {
      props.closeForm();
      props.actionComplete();
    });
  }

  const availableAmount = fiduFromAtomic(props.capitalProvider.availableToWithdrawal);
  const availableToWithdraw = minimumNumber(availableAmount, usdcFromAtomic(props.poolData.balance));

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(availableToWithdraw)}`}
      submitTransaction={action}
      closeForm={props.closeForm}
      maxAmount={availableToWithdraw}
    />
  );
}

export default WithdrawalForm;
