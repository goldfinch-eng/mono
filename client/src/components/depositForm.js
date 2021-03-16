import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { AppContext } from '../App.js';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';
import useSendFromUser from '../hooks/useSendFromUser';

function DepositForm(props) {
  const { pool, user, goldfinchConfig } = useContext(AppContext);
  const sendFromUser = useSendFromUser();

  function action({ transactionAmount }) {
    const depositAmount = usdcToAtomic(transactionAmount);
    return sendFromUser(pool.methods.deposit(depositAmount), {
      type: 'Deposit',
      amount: transactionAmount,
    }).then(props.actionComplete);
  }

  function renderForm({ formMethods }) {
    let warningMessage, disabled;
    if (user.usdcBalance.eq(0)) {
      disabled = true;
      warningMessage = (
        <p className="form-message">
          You don't have any USDC to deposit. You'll need to first send USDC to your address to deposit.
        </p>
      );
    } else if (pool.gf.totalPoolAssets.gte(goldfinchConfig.totalFundsLimit)) {
      disabled = true;
      warningMessage = (
        <p className="form-message">
          The pool is currently at its limit. Please check back later to see if we're accepting new deposits.
        </p>
      );
    }

    return (
      <div className="form-inputs">
        {warningMessage}
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            disabled={disabled}
            validations={{
              wallet: value => user.usdcBalanceInDollars.gte(value) || 'You do not have enough USDC',
              transactionLimit: value =>
                goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                `This is over the per-transaction limit of $${usdcFromAtomic(goldfinchConfig.transactionLimit)}`,
              totalFundsLimit: value => {
                let limit = goldfinchConfig.totalFundsLimit.minus(pool.gf.totalPoolAssets);
                return (
                  limit.gte(usdcToAtomic(value)) ||
                  `This deposit would put the pool over its limit. It can accept a max of $${usdcFromAtomic(limit)}.`
                );
              },
            }}
          />
          <LoadingButton action={action} disabled={disabled} />
        </div>
      </div>
    );
  }

  return (
    <TransactionForm
      title="Deposit"
      headerMessage={`Available to deposit: ${displayDollars(user.usdcBalanceInDollars)}`}
      render={renderForm}
      closeForm={props.closeForm}
    />
  );
}

export default DepositForm;
