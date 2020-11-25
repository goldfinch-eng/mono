import React, { useContext } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { AppContext } from '../App.js';
import { displayDollars } from '../utils';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';

function DepositForm(props) {
  const { pool, user, goldfinchConfig } = useContext(AppContext);

  function action({ transactionAmount }) {
    const depositAmount = usdcToAtomic(transactionAmount);
    return pool.methods.deposit(depositAmount);
  }

  function actionComplete() {
    props.actionComplete();
    props.closeForm();
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
    } else if (pool.data.totalPoolAssets.gte(goldfinchConfig.totalFundsLimit)) {
      disabled = true;
      warningMessage = (
        <p className="form-message">
          The pool is currently at it's limit. Please check back later to see if we're accepting new deposits.
        </p>
      );
    }

    return (
      <div className="form-inputs">
        {warningMessage}
        <TransactionInput
          formMethods={formMethods}
          maxAmount={minimumNumber(user.usdcBalanceInDollars, usdcFromAtomic(goldfinchConfig.transactionLimit))}
          disabled={disabled}
        />
        <LoadingButton
          disabled={disabled}
          action={() => action(formMethods.getValues())}
          actionComplete={actionComplete}
          txData={{ type: 'Deposit', amount: formMethods.getValues('transactionAmount') }}
          sendFromUser={true}
        />
      </div>
    );
  }

  return (
    <TransactionForm
      title="Deposit"
      headerMessage={`Available to deposit: ${displayDollars(user.usdcBalanceInDollars)}`}
      render={renderForm}
      closeForm={props.closeForm}
      needsApproval={true}
    />
  );
}

export default DepositForm;
