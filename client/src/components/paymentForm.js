import React, { useContext, useState, useEffect } from 'react';
import { usdcToAtomic, minimumNumber, usdcFromAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import { displayDollars, displayNumber } from '../utils';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';
import CurrencySelector from './currencySelector';
import useSendFromUser from '../hooks/useSendFromUser';
import BigNumber from 'bignumber.js';
import UnlockERC20Form from './unlockERC20Form';
import { getERC20 } from '../ethereum/erc20';
import useCurrencyUnlocked from '../hooks/useCurrencyUnlocked';
import { useOneInchQuote, formatQuote, useAmountTargetingMinAmount } from '../hooks/useOneInchQuote';
import useDebounce from '../hooks/useDebounce';

function PaymentForm(props) {
  const { borrower, creditLine, actionComplete } = props;

  const { usdc, user, goldfinchConfig, network } = useContext(AppContext);

  const [inputClass, setInputClass] = useState('');
  const sendFromUser = useSendFromUser();
  const [erc20, setErc20] = useState(usdc);
  const [unlocked, setUnlocked] = useCurrencyUnlocked(erc20, {
    owner: borrower.userAddress,
    spender: borrower.borrowerAddress,
  });
  const [transactionAmount, setTransactionAmount] = useState();
  const debouncedSetTransactionAmount = useDebounce(setTransactionAmount, 200);
  const [transactionAmountQuote, isQuoteLoading] = useOneInchQuote({
    from: erc20,
    to: usdc,
    decimalAmount: transactionAmount,
  });
  const networkId = network.name;

  function isSwapping() {
    return erc20 !== usdc;
  }

  function action({ transactionAmount }) {
    const amount = erc20.atomicAmount(transactionAmount);

    let unsentAction;
    if (isSwapping()) {
      unsentAction = borrower.payWithSwapOnOneInch(creditLine.address, amount, erc20.address);
    } else {
      unsentAction = borrower.pay(creditLine.address, amount);
    }

    return sendFromUser(unsentAction, {
      type: 'Payment',
      amount: transactionAmount,
      gasless: borrower.gasless,
    }).then(actionComplete);
  }

  const remainingPeriodDueDisplay = displayDollars(props.creditLine.remainingPeriodDueAmountInDollars);

  const [minimumDueAmount] = useAmountTargetingMinAmount({
    from: erc20,
    to: usdc,
    targetMinAmount: props.creditLine.remainingPeriodDueAmountInDollars,
  });
  const [fullDueAmount] = useAmountTargetingMinAmount({
    from: erc20,
    to: usdc,
    targetMinAmount: props.creditLine.remainingTotalDueAmountInDollars,
  });

  function formatSwapAmount(amount) {
    if (!amount) return '';
    return `(~${displayNumber(amount, 2)} ${erc20.ticker})`;
  }

  let valueOptions = [
    {
      name: 'totalDue',
      label: ({ value, swapValue }) => (
        <>
          Pay full balance plus interest: <span class="font-bold">{displayDollars(value)}</span>{' '}
          {formatSwapAmount(swapValue)}
        </>
      ),
      value: props.creditLine.remainingTotalDueAmountInDollars,
      swapValue: fullDueAmount,
    },
    { name: 'other', label: () => 'Pay other amount', value: 'other' },
  ];

  if (props.creditLine.remainingPeriodDueAmount.gt(0)) {
    valueOptions.unshift({
      name: 'remainingDue',
      label: ({ value, swapValue }) => (
        <>
          Pay minimum due: <span class="font-bold">{displayDollars(value)}</span> {formatSwapAmount(swapValue)}
        </>
      ),
      value: props.creditLine.remainingPeriodDueAmountInDollars,
      swapValue: minimumDueAmount,
    });
  }

  function getValueOptionsList(formMethods) {
    return valueOptions.map((valueOption, index) => {
      return (
        <div className="value-option" key={index}>
          <input
            name="paymentOption"
            type="radio"
            defaultChecked={valueOption.value === formMethods.getValues('paymentOption')}
            id={`value-type-${index}`}
            ref={formMethods.register}
            value={valueOption.value}
            onChange={() => {
              let { value, swapValue } = valueOption;
              if (!isNaN(value)) {
                formMethods.setValue('transactionAmount', swapValue ? swapValue : value, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                setTransactionAmount(formMethods.getValues('transactionAmount'));
                setInputClass('pre-filled');
              }
            }}
          />
          <div className="radio-check"></div>
          <label htmlFor={`value-type-${index}`}>{valueOption.label(valueOption)}</label>
        </div>
      );
    });
  }

  function renderForm({ formMethods }) {
    const valueOptionList = getValueOptionsList(formMethods);
    let valueOptionsHTML = <div className="value-options">{valueOptionList}</div>;

    async function changeTicker(ticker) {
      let erc20 = await getERC20(ticker, networkId);
      setErc20(erc20);
    }

    return (
      <>
        <CurrencySelector onChange={changeTicker} />
        {unlocked || (
          <UnlockERC20Form erc20={erc20} onUnlock={() => setUnlocked(true)} unlockAddress={borrower.borrowerAddress} />
        )}
        <div className="form-inputs">
          {valueOptionsHTML}
          <TransactionInput
            ticker={erc20.ticker}
            formMethods={formMethods}
            onChange={e => {
              formMethods.setValue('paymentOption', 'other', { shouldValidate: true, shouldDirty: true });
              setInputClass('');
              debouncedSetTransactionAmount(formMethods.getValues('transactionAmount'));
            }}
            validations={{
              wallet: value => user.usdcBalanceInDollars.gte(value) || 'You do not have enough USDC',
              transactionLimit: value =>
                goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                `This is over the per-transaction limit of $${usdcFromAtomic(goldfinchConfig.transactionLimit)}`,
              creditLine: value => {
                if (!isSwapping() && props.creditLine.remainingTotalDueAmountInDollars.lt(value)) {
                  return 'This is over the total balance of the credit line.';
                }
              },
            }}
            inputClass={inputClass}
            notes={[
              transactionAmountQuote &&
                !isQuoteLoading && {
                  key: 'quote',
                  content: <p>~${formatQuote({ erc20: usdc, quote: transactionAmountQuote })}</p>,
                },
            ]}
          />
          <LoadingButton action={action} disabled={!unlocked} />
        </div>
      </>
    );
  }

  return (
    <TransactionForm
      title="Pay"
      headerMessage={`Next payment: ${remainingPeriodDueDisplay} due ${props.creditLine.dueDate}`}
      formClass="dark"
      render={renderForm}
      closeForm={props.closeForm}
    />
  );
}

export default PaymentForm;
