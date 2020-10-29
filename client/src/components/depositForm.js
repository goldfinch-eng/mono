import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { sendFromUser } from '../ethereum/utils';
import { AppContext } from '../App.js';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';

function DepositForm(props) {
  const { pool, user, goldfinchConfig } = useContext(AppContext);

  function action(value) {
    const depositAmount = usdcToAtomic(value);
    const userAddress = props.capitalProvider.address;
    return sendFromUser(pool.methods.deposit(depositAmount), userAddress).then(result => {
      props.actionComplete();
      props.closeForm();
    });
  }

  const message = `Deposit funds into the pool. You have ${displayDollars(
    user.usdcBalance,
  )} of USDC available to deposit.`;

  return (
    <TransactionForm
      navOptions={[{ label: 'Deposit', value: 'deposit', message: message, submitTransaction: action }]}
      closeForm={props.closeForm}
      needsApproval={true}
      maxAmount={minimumNumber(user.usdcBalance, usdcFromAtomic(goldfinchConfig.transactionLimit))}
    />
  );
}

export default DepositForm;
