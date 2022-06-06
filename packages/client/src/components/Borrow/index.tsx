import React, {useState, useContext, useEffect} from "react"
import CreditActionsContainer from "./CreditActionsContainer"
import CreditActionsMultipleContainer from "./CreditActionsMultipleContainer"
import CreditStatus from "./CreditStatus"
import ConnectionNotice from "../connectionNotice"
import BorrowHeader from "./BorrowHeader"
import {fetchCreditLineData, CreditLine, MultipleCreditLines} from "../../ethereum/creditLine"
import {AppContext} from "../../App"
import CreditLinesList from "./CreditLinesList"
import {useBorrow} from "../../contexts/BorrowContext"
import {assertNonNullable} from "../../utils"

function Borrow() {
  const {creditDesk, user, goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [creditLinesAddresses, setCreditLinesAddresses] = useState<string[]>([])
  const [creditLine, setCreditLine] = useState<CreditLine | MultipleCreditLines | undefined>()
  const {borrowStore, setBorrowStore} = useBorrow()

  async function updateBorrowerAndCreditLine() {
    if (user && user.borrower && creditDesk) {
      const borrowerCreditLines = user.borrower.creditLinesAddresses
      setCreditLinesAddresses(borrowerCreditLines)
      changeCreditLine(borrowerCreditLines)
    }
  }

  useEffect(() => {
    updateBorrowerAndCreditLine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditDesk, user, currentBlock])

  useEffect(() => {
    if (creditLine) {
      setBorrowStore({...borrowStore, creditLine})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditLine])

  const creditLineData = borrowStore.creditLine

  async function actionComplete(): Promise<void> {
    // No need to do anything here to trigger refreshing the chain data;
    // that refreshing is accomplished via the invocation of `updateBorrowerAndCreditLine()`
    // upon the changing of `currentBlock`.
  }

  async function changeCreditLine(clAddresses: string | string[]) {
    assertNonNullable(goldfinchProtocol)
    assertNonNullable(currentBlock)
    setCreditLine(await fetchCreditLineData(clAddresses, goldfinchProtocol, currentBlock))
  }

  const disabled = !creditLine || !creditLine.loaded

  let creditActionsContainer
  let creditLineStatus
  if (creditLineData && user?.borrower) {
    if (creditLineData.isMultiple) {
      creditActionsContainer = (
        <CreditActionsMultipleContainer
          borrower={user.borrower}
          creditLine={creditLineData}
          actionComplete={actionComplete}
          disabled={disabled}
        />
      )
      creditLineStatus = (
        <CreditLinesList creditLine={creditLineData} changeCreditLine={changeCreditLine} disabled={disabled} />
      )
    } else {
      creditActionsContainer = (
        <CreditActionsContainer
          borrower={user.borrower}
          creditLine={creditLineData}
          actionComplete={actionComplete}
          disabled={disabled}
        />
      )
      creditLineStatus = (
        <CreditStatus creditLine={creditLineData} user={user} borrower={user.borrower} disabled={disabled} />
      )
    }
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <BorrowHeader
          user={user}
          selectedCreditLine={creditLineData}
          creditLinesAddresses={creditLinesAddresses}
          changeCreditLine={changeCreditLine}
        />
      </div>
      <ConnectionNotice
        showCreditLineStatus={true}
        requireUnlock={!!(user && user.borrower && user.borrower.creditLinesAddresses.length)}
      />
      {creditActionsContainer}
      {creditLineStatus}
    </div>
  )
}

export default Borrow
