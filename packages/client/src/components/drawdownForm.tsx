import React, {useContext, useState, useEffect} from "react"
import {usdcFromAtomic, minimumNumber, usdcToAtomic} from "../ethereum/erc20"
import {AppContext} from "../App"
import TransactionForm from "./transactionForm"
import {fetchPoolData} from "../ethereum/pool"
import {displayDollars, roundDownPenny} from "../utils"
import AddressInput from "./addressInput"
import TransactionInput from "./transactionInput"
import LoadingButton from "./loadingButton"
import useSendFromUser from "../hooks/useSendFromUser"
import {useOneInchQuote, formatQuote} from "../hooks/useOneInchQuote"
import useDebounce from "../hooks/useDebounce"
import UnlockERC20Form from "./unlockERC20Form"
import useCurrencyUnlocked from "../hooks/useCurrencyUnlocked"
import CurrencyDropdown from "./currencyDropdown"

function DrawdownForm(props) {
  const {pool, usdc, goldfinchConfig, goldfinchProtocol} = useContext(AppContext)
  const [poolData, setPoolData] = useState({})
  const sendFromUser = useSendFromUser()
  const [erc20, setErc20] = useState(usdc)
  // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '{ owner: any; spender: any; }' i... Remove this comment to see the full error message
  const [unlocked, refreshUnlocked] = useCurrencyUnlocked(erc20, {
    owner: props.borrower.userAddress,
    spender: props.borrower.borrowerAddress,
  })
  const [transactionAmount, setTransactionAmount] = useState()
  const debouncedSetTransactionAmount = useDebounce(setTransactionAmount, 200)
  const [transactionAmountQuote, isQuoteLoading] = useOneInchQuote({
    from: usdc,
    to: erc20,
    decimalAmount: transactionAmount,
  })

  const [isOptionsOpen, setOptionsOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
      // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'SeniorPool | undefined' is not a... Remove this comment to see the full error message
      setPoolData(await fetchPoolData(pool, usdc.contract))
    })()
  }, [pool, usdc])

  function isSwapping() {
    return erc20 !== usdc
  }

  function action({transactionAmount, sendToAddress}) {
    const drawdownAmount = usdcToAtomic(transactionAmount)
    sendToAddress = sendToAddress || props.borrower.address

    let unsentAction
    if (isSwapping()) {
      unsentAction = props.borrower.drawdownViaOneInch(
        props.creditLine.address,
        drawdownAmount,
        sendToAddress,
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        erc20.address
      )
    } else {
      unsentAction = props.borrower.drawdown(props.creditLine.address, drawdownAmount, sendToAddress)
    }

    return sendFromUser(unsentAction, {
      type: "Borrow",
      amount: transactionAmount,
      gasless: props.borrower.shouldUseGasless,
    }).then(props.actionComplete)
  }

  const maxAmountInDollars = minimumNumber(
    props.creditLine.availableCreditInDollars,
    usdcFromAtomic((poolData as any).balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit)
  )

  async function changeTicker(ticker) {
    // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
    setErc20(goldfinchProtocol.getERC20(ticker))
  }

  function renderForm({formMethods}) {
    let warningMessage, disabled
    if (props.creditLine.isLate) {
      warningMessage = <p className="form-message">Cannot drawdown when payment is past due</p>
      disabled = true
    }
    disabled = disabled || !unlocked

    return (
      <>
        <button
          className={`form-show-optional ${isOptionsOpen ? "showing" : "hidden"}`}
          onClick={(e) => {
            e.preventDefault()
            setOptionsOpen(!isOptionsOpen)
          }}
        >
          Options
        </button>
        <div className="form-inputs">
          {warningMessage}
          <div className={`form-optional ${isOptionsOpen ? "showing" : "hidden"}`}>
            <div>
              <div className="form-input-label">Receive funds in specified stablecoin</div>
              <CurrencyDropdown selectedClassName="form-input small-text" onChange={changeTicker} />
            </div>
            <div>
              <div className="form-input-label">Send to a specific address</div>
              <AddressInput formMethods={formMethods} disabled={disabled} />
            </div>
          </div>
          {isOptionsOpen && <div className="form-separator background-container-inner"></div>}
          {unlocked || (
            <UnlockERC20Form
              erc20={erc20}
              // @ts-expect-error ts-migrate(2349) FIXME: This expression is not callable.
              onUnlock={() => refreshUnlocked()}
              unlockAddress={props.borrower.borrowerAddress}
            />
          )}
          <div>
            <div className="form-input-label">Amount</div>
            <div className="form-inputs-footer">
              <TransactionInput
                formMethods={formMethods}
                maxAmountInDollars={maxAmountInDollars}
                disabled={disabled}
                onChange={(e) => {
                  debouncedSetTransactionAmount(formMethods.getValues("transactionAmount"))
                }}
                rightDecoration={
                  <button
                    className="enter-max-amount"
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      formMethods.setValue("transactionAmount", roundDownPenny(maxAmountInDollars), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }}
                  >
                    Max
                  </button>
                }
                notes={
                  transactionAmountQuote && !isQuoteLoading
                    ? [
                        {
                          key: "quote",
                          content: (
                            <p>You will receive ~${formatQuote({erc20: erc20, quote: transactionAmountQuote})}</p>
                          ),
                        },
                      ]
                    : undefined
                }
              />
              <LoadingButton action={action} disabled={disabled} />
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <TransactionForm
      formClass="drawdown-form"
      title="Borrow"
      headerMessage={`Available to borrow: ${displayDollars(props.creditLine.availableCreditInDollars)}`}
      render={renderForm}
      closeForm={props.closeForm}
    />
  )
}

export default DrawdownForm
