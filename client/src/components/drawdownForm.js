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
  const { creditDesk, pool, erc20, goldfinchConfig } = useContext(AppContext);
  const [poolData, setPoolData] = useState({});
  const sendFromUser = useSendFromUser();

  useEffect(() => {
    (async () => {
      setPoolData(await fetchPoolData(pool, erc20));
    })();
  }, []);

  function action({ transactionAmount, sendToAddress }) {
    const drawdownAmount = usdcToAtomic(transactionAmount);
    sendToAddress = sendToAddress || props.borrower.address;
    return sendFromUser(creditDesk.methods.drawdown(drawdownAmount, props.creditLine.address, sendToAddress), {
      type: 'Borrow',
      amount: transactionAmount,
    }).then(actionComplete);
  }

  function actionComplete() {
    props.closeForm();
    props.actionComplete();
  }

  const maxAmount = minimumNumber(
    props.creditLine.availableCreditInDollars,
    usdcFromAtomic(poolData.balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit),
  );

  function renderForm({ formMethods }) {
    return (
      <div className="form-inputs">
        <div className="form-input-label">(Optional) Send to a specific address</div>
        <AddressInput formMethods={formMethods} />
        <div className="form-input-label">Amount</div>
        <TransactionInput formMethods={formMethods} maxAmount={maxAmount} />
        <button
          className="enter-max-amount"
          type="button"
          onClick={() => {
            formMethods.setValue('transactionAmount', roundDownPenny(maxAmount), {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        >
          Max
        </button>
        <LoadingButton action={action} />
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
