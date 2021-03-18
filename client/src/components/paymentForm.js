import React, { useContext, useState, useEffect } from 'react';
import { usdcToAtomic, usdcFromAtomic } from '../ethereum/erc20';
import { AppContext } from '../App';
import PaymentOptions from './paymentOptions';
import TransactionForm from './transactionForm';
import TransactionInput from './transactionInput';
import LoadingButton from './loadingButton';
import CurrencyDropdown from './currencyDropdown';
import useSendFromUser from '../hooks/useSendFromUser';
import UnlockERC20Form from './unlockERC20Form';
import { getERC20 } from '../ethereum/erc20';
import useCurrencyUnlocked from '../hooks/useCurrencyUnlocked';
import { useOneInchQuote, formatQuote } from '../hooks/useOneInchQuote';
import useDebounce from '../hooks/useDebounce';
import BigNumber from 'bignumber.js';

function PaymentForm(props) {
  const { borrower, creditLine, actionComplete } = props;
  const { usdc, user, goldfinchConfig, network } = useContext(AppContext);

  const [inputClass, setInputClass] = useState('');
  const [paymentOption, setPaymentOption] = useState('periodDue');
  const sendFromUser = useSendFromUser();
  const [erc20, setErc20] = useState(usdc);
  const [erc20UserBalance, setErc20UserBalance] = useState(new BigNumber(0));
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

  useEffect(() => {
    const fetchBalance = async () => {
      const decimalAmount = new BigNumber(erc20.decimalAmount(await erc20.getBalance(user.address)));
      setErc20UserBalance(decimalAmount);
    };
    fetchBalance();
  }, [erc20, user]);

  function isSwapping() {
    return erc20 !== usdc;
  }

  function getSelectedUSDCAmount() {
    if (paymentOption === 'totalDue') {
      return usdcToAtomic(creditLine.remainingTotalDueAmountInDollars);
    } else if (paymentOption === 'periodDue') {
      return usdcToAtomic(creditLine.remainingPeriodDueAmountInDollars);
    } else if (paymentOption === 'other') {
      return isSwapping() ? transactionAmountQuote.returnAmount : transactionAmount;
    }
  }

  function action({ transactionAmount }) {
    const amount = erc20.atomicAmount(transactionAmount);
    let unsentAction;
    if (creditLine.isMultiple) {
      let addresses = [];
      let amounts = [];
      if (paymentOption === 'totalDue') {
        creditLine.creditLines.forEach(cl => {
          if (cl.remainingTotalDueAmount.gt(0)) {
            addresses.push(cl.address);
            amounts.push(usdcToAtomic(cl.remainingTotalDueAmountInDollars));
          }
        });
      } else if (paymentOption === 'periodDue') {
        creditLine.creditLines.forEach(cl => {
          if (cl.remainingPeriodDueAmount.gt(0)) {
            addresses.push(cl.address);
            amounts.push(usdcToAtomic(cl.remainingPeriodDueAmountInDollars));
          }
        });
      } else {
        // Other amount. Split across all credit lines depending on what's due. If we're swapping then
        // we need to split the USDC value (the quote) rather than the user provided input. Since the USDC
        // value will be what's used to pay
        [addresses, amounts] = creditLine.splitPayment(getSelectedUSDCAmount());
      }
      if (isSwapping()) {
        unsentAction = borrower.payMultipleWithSwapOnOneInch(
          addresses,
          amounts,
          amount,
          erc20.address,
          transactionAmountQuote,
        );
      } else {
        unsentAction = borrower.payMultiple(addresses, amounts);
      }
    } else {
      if (isSwapping()) {
        unsentAction = borrower.payWithSwapOnOneInch(
          creditLine.address,
          amount,
          getSelectedUSDCAmount(),
          erc20.address,
          transactionAmountQuote,
        );
      } else {
        unsentAction = borrower.pay(creditLine.address, amount);
      }
    }
    return sendFromUser(unsentAction, {
      type: 'Payment',
      amount: transactionAmount,
      gasless: borrower.gasless,
    }).then(actionComplete);
  }

  function renderForm({ formMethods }) {
    async function changeTicker(ticker) {
      let erc20 = await getERC20(ticker, networkId);
      setErc20(erc20);
    }

    return (
      <>
        <div className={'currency-selector'}>
          <span>Pay with: </span>
          <CurrencyDropdown onChange={changeTicker} />
        </div>
        {unlocked || (
          <UnlockERC20Form erc20={erc20} onUnlock={() => setUnlocked(true)} unlockAddress={borrower.borrowerAddress} />
        )}
        <div className="form-inputs">
          <PaymentOptions
            formMethods={formMethods}
            usdc={usdc}
            erc20={erc20}
            creditLine={props.creditLine}
            selected={paymentOption}
            onSelect={(name, value) => {
              if (name === 'other') {
                setInputClass('');
              } else {
                // pre-filled
                formMethods.setValue('transactionAmount', value, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                setTransactionAmount(formMethods.getValues('transactionAmount'));
                setInputClass('pre-filled');
              }
              setPaymentOption(name);
            }}
          />
          <div className="form-inputs-footer">
            <TransactionInput
              ticker={erc20.ticker}
              formMethods={formMethods}
              onChange={e => {
                setPaymentOption('other');
                setInputClass('');
                debouncedSetTransactionAmount(formMethods.getValues('transactionAmount'));
              }}
              validations={{
                wallet: value => erc20UserBalance.gte(value) || `You do not have enough ${erc20.ticker}`,
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
            <LoadingButton action={action} disabled={!unlocked || isQuoteLoading} />
          </div>
        </div>
      </>
    );
  }

  return (
    <TransactionForm
      title="Pay"
      headerMessage={props.title}
      formClass="payment-form dark"
      render={renderForm}
      closeForm={props.closeForm}
    />
  );
}

export default PaymentForm;
