import React, {useContext, useState, useEffect, useCallback} from "react"
import {usdcToAtomic, usdcFromAtomic} from "../ethereum/erc20"
import {AppContext} from "../App"
import PaymentOptions from "./paymentOptions"
import TransactionForm from "./transactionForm"
import TransactionInput from "./transactionInput"
import LoadingButton from "./loadingButton"
import CurrencyDropdown from "./currencyDropdown"
import useSendFromUser from "../hooks/useSendFromUser"
import UnlockERC20Form from "./unlockERC20Form"
import useCurrencyUnlocked from "../hooks/useCurrencyUnlocked"
import {useOneInchQuote, formatQuote} from "../hooks/useOneInchQuote"
import useDebounce from "../hooks/useDebounce"
import BigNumber from "bignumber.js"

function PaymentForm(props) {
  const {borrower, creditLine, actionComplete} = props
  const {usdc, user, goldfinchConfig, goldfinchProtocol} = useContext(AppContext)

  const [inputClass, setInputClass] = useState("")
  const [paymentOption, setPaymentOption] = useState("periodDue")
  const sendFromUser = useSendFromUser()
  const [erc20, setErc20] = useState(usdc)
  const [, setErc20UserBalance] = useState(new BigNumber(0))
  const [validations, setValidations] = useState({})
  const [unlocked, refreshUnlocked] = useCurrencyUnlocked(erc20, {
    owner: borrower.userAddress,
    spender: borrower.borrowerAddress,
  })
  const [transactionAmount, setTransactionAmount] = useState()
  const debouncedSetTransactionAmount = useDebounce(setTransactionAmount, 200)
  const [transactionAmountQuote, isQuoteLoading] = useOneInchQuote({
    from: erc20,
    to: usdc,
    decimalAmount: transactionAmount,
  })

  const isSwapping = useCallback(() => {
    return erc20 !== usdc
  }, [erc20, usdc])

  // HACK: Use `BigNumber.toString()` to prevent a re-render due to different BigNumber instances
  // of the same number failing React's shallow equality check. This follows
  // https://github.com/goldfinch-eng/goldfinch-protocol/pull/199/commits/6fcdf5307e7726b9a1dad8312e763f7a32039c3b#r593476200.
  // Ideal solution is to implement caching / memoization as far upstream as possible, so that we
  // receive a different BigNumber instance here only when the number has actually changed. In this case,
  // that would be located in `BaseCreditLine.inDollars()`.
  const remainingTotalDueAmountInDollarsDependency =
    props.creditLine.remainingTotalDueAmountInDollars && props.creditLine.remainingTotalDueAmountInDollars.toString()

  useEffect(
    () => {
      const fetchBalance = async () => {
        const decimalAmount = new BigNumber(erc20.decimalAmount(await erc20.getBalance(user.address)))
        setErc20UserBalance(decimalAmount)
        setValidations({
          wallet: (value) => decimalAmount.gte(value) || `You do not have enough ${erc20.ticker}`,
          transactionLimit: (value) =>
            goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
            `This is over the per-transaction limit of $${usdcFromAtomic(goldfinchConfig.transactionLimit)}`,
          creditLine: (value) => {
            if (!isSwapping() && props.creditLine.remainingTotalDueAmountInDollars.lt(value)) {
              return "This is over the total balance of the credit line."
            }
          },
        })
      }
      fetchBalance()
    },
    // HACK: Disable eslint's complaint about exhaustive-deps, since it doesn't understand our intention
    // with `remainingTotalDueAmountInDollarsDependency`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [erc20, user, goldfinchConfig.transactionLimit, isSwapping, remainingTotalDueAmountInDollarsDependency]
  )

  function getSelectedUSDCAmount() {
    if (paymentOption === "totalDue") {
      return usdcToAtomic(creditLine.remainingTotalDueAmountInDollars)
    } else if (paymentOption === "periodDue") {
      return usdcToAtomic(creditLine.remainingPeriodDueAmountInDollars)
    } else if (paymentOption === "other") {
      return isSwapping() ? transactionAmountQuote.returnAmount : transactionAmount
    }
  }

  function action({transactionAmount}) {
    const erc20Amount = erc20.atomicAmount(transactionAmount)
    let unsentAction
    if (creditLine.isMultiple) {
      let addresses = []
      let usdcAmounts = []
      if (paymentOption === "totalDue") {
        creditLine.creditLines.forEach((cl) => {
          if (cl.remainingTotalDueAmount.gt(0)) {
            addresses.push(cl.address)
            usdcAmounts.push(usdcToAtomic(cl.remainingTotalDueAmountInDollars))
          }
        })
      } else if (paymentOption === "periodDue") {
        creditLine.creditLines.forEach((cl) => {
          if (cl.remainingPeriodDueAmount.gt(0)) {
            addresses.push(cl.address)
            usdcAmounts.push(usdcToAtomic(cl.remainingPeriodDueAmountInDollars))
          }
        })
      } else {
        // Other amount. Split across all credit lines depending on what's due. If we're swapping then
        // we need to split the USDC value (the quote) rather than the user provided input. Since the USDC
        // value will be what's used to pay
        ;[addresses, usdcAmounts] = creditLine.splitPayment(getSelectedUSDCAmount())
      }
      if (isSwapping()) {
        unsentAction = borrower.payMultipleWithSwapOnOneInch(
          addresses,
          usdcAmounts,
          erc20Amount,
          erc20.address,
          transactionAmountQuote
        )
      } else {
        unsentAction = borrower.payMultiple(addresses, usdcAmounts)
      }
    } else {
      if (isSwapping()) {
        unsentAction = borrower.payWithSwapOnOneInch(
          creditLine.address,
          erc20Amount,
          getSelectedUSDCAmount(),
          erc20.address,
          transactionAmountQuote
        )
      } else {
        // When not swapping, the erc20 is usdc
        unsentAction = borrower.pay(creditLine.address, erc20Amount)
      }
    }
    return sendFromUser(unsentAction, {
      type: "Payment",
      amount: transactionAmount,
      gasless: borrower.shouldUseGasless,
    }).then(actionComplete)
  }

  function renderForm({formMethods}) {
    async function changeTicker(ticker) {
      setErc20(goldfinchProtocol.getERC20(ticker))
    }

    return (
      <>
        <div className={"currency-selector"}>
          <span>Pay with: </span>
          <CurrencyDropdown onChange={changeTicker} />
        </div>
        {unlocked || (
          <UnlockERC20Form erc20={erc20} onUnlock={() => refreshUnlocked()} unlockAddress={borrower.borrowerAddress} />
        )}
        <div className="form-inputs">
          <PaymentOptions
            formMethods={formMethods}
            usdc={usdc}
            erc20={erc20}
            creditLine={props.creditLine}
            selected={paymentOption}
            onSelect={(name, value) => {
              if (name === "other") {
                setInputClass("")
              } else {
                // pre-filled
                formMethods.setValue("transactionAmount", value.toString(), {
                  shouldValidate: true,
                  shouldDirty: true,
                })
                setTransactionAmount(formMethods.getValues("transactionAmount"))
                setInputClass("pre-filled")
              }
              setPaymentOption(name)
            }}
          />
          <div className="form-inputs-footer">
            <TransactionInput
              ticker={erc20.ticker}
              formMethods={formMethods}
              onChange={(e) => {
                setPaymentOption("other")
                setInputClass("")
                debouncedSetTransactionAmount(formMethods.getValues("transactionAmount"))
              }}
              validations={validations}
              inputClass={inputClass}
              notes={[
                transactionAmountQuote &&
                  !isQuoteLoading && {
                    key: "quote",
                    content: <p>~${formatQuote({erc20: usdc, quote: transactionAmountQuote})}</p>,
                  },
              ]}
            />
            <LoadingButton action={action} disabled={!unlocked || isQuoteLoading} />
          </div>
        </div>
      </>
    )
  }

  return (
    <TransactionForm
      title="Pay"
      headerMessage={props.title}
      formClass="payment-form dark"
      render={renderForm}
      closeForm={props.closeForm}
    />
  )
}

export default PaymentForm
