import React, { useContext, useState, useEffect } from 'react';
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import TransactionForm from './transactionForm';
import { fetchPoolData } from '../ethereum/pool';
import { displayDollars, roundDownPenny } from '../utils';
import AddressInput from './addressInput';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';
import useSendFromUser from '../hooks/useSendFromUser';

function DrawdownForm(props) {
  const { creditDesk, pool, usdc, goldfinchConfig } = useContext(AppContext);
  const [poolData, setPoolData] = useState({});
  const sendFromUser = useSendFromUser();

  useEffect(() => {
    (async () => {
      setPoolData(await fetchPoolData(pool, usdc.contract));
    })();
  }, [pool, usdc]);

  function action({ transactionAmount, sendToAddress }) {
    const drawdownAmount = usdcToAtomic(transactionAmount);
    sendToAddress = sendToAddress || props.borrower.address;
    return sendFromUser(props.borrower.drawdown(props.creditLine.address, drawdownAmount, sendToAddress), {
      type: 'Borrow',
      amount: transactionAmount,
      gasless: props.borrower.gasless,
    }).then(props.actionComplete);
  }

  const maxAmount = minimumNumber(
    props.creditLine.availableCreditInDollars,
    usdcFromAtomic(poolData.balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit),
  );

  function renderForm({ formMethods }) {
    let warningMessage, disabled;
    if (props.creditLine.isLate) {
      warningMessage = <p className="form-message">Cannot drawdown when payment is past due</p>;
      disabled = true;
    }

    return (
      <div className="form-inputs">
        {warningMessage}
        <div className="form-input-label">(Optional) Send to a specific address</div>
        <AddressInput formMethods={formMethods} disabled={disabled} />
        <div className="form-input-label">Amount</div>
        <TransactionInput
          formMethods={formMethods}
          maxAmount={maxAmount}
          disabled={disabled}
          rightDecoration={
            <button
              className="enter-max-amount"
              type="button"
              disabled={disabled}
              onClick={() => {
                formMethods.setValue('transactionAmount', roundDownPenny(maxAmount), {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              }}
            >
              Max
            </button>
          }
        />
        <LoadingButton action={action} disabled={disabled} />
      </div>
    );
  }

  return (
    <TransactionForm
      title="Borrow"
      headerMessage={`Available to borrow: ${displayDollars(props.creditLine.availableCreditInDollars)}`}
      render={renderForm}
      closeForm={props.closeForm}
    />
  );
}

export default DrawdownForm;
