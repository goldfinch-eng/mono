import React, {useState, useContext, useEffect} from "react"
import CreditActionsContainer from "./creditActionsContainer"
import CreditActionsMultipleContainer from "./creditActionsMultipleContainer"
import CreditStatus from "./creditStatus"
import ConnectionNotice from "./connectionNotice"
import BorrowHeader from "./borrowHeader"
import {fetchCreditLineData, defaultCreditLine} from "../ethereum/creditLine"
import {AppContext} from "../App"
import CreditLinesList from "./creditLinesList"
import {useBorrow} from "../contexts/BorrowContext"
import {assertNonNullable} from "../utils"

function Borrow(props) {
  const {creditDesk, user, goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [creditLinesAddresses, setCreditLinesAddresses] = useState<string[]>([])
  const [creditLine, setCreditLine] = useState(defaultCreditLine)
  const {borrowStore, setBorrowStore} = useBorrow()

  async function updateBorrowerAndCreditLine() {
    if (user && user.borrower && creditDesk) {
      const borrowerCreditLines = user.borrower.creditLinesAddresses
      setCreditLinesAddresses(borrowerCreditLines)
      if (!creditLine.loaded || (creditLine.loaded && !creditLine.address)) {
        changeCreditLine(borrowerCreditLines)
      }
    }
  }

  useEffect(() => {
    if (!creditDesk) {
      return
    }
    updateBorrowerAndCreditLine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditDesk, user])

  const isDefaultCreditLine = creditLine.isDefaultObject
  useEffect(() => {
    if (!isDefaultCreditLine) {
      setBorrowStore({...borrowStore, creditLine})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditLine])

  const creditLineData = borrowStore.creditLine

  async function actionComplete() {
    return changeCreditLine(creditLineData.address)
  }

  async function changeCreditLine(clAddresses) {
    assertNonNullable(goldfinchProtocol)
    assertNonNullable(currentBlock)
    setCreditLine(await fetchCreditLineData(clAddresses, goldfinchProtocol, currentBlock))
  }

  let creditActionsContainer
  let creditLineStatus
  if (creditLineData.isMultiple) {
    creditActionsContainer = (
      <CreditActionsMultipleContainer
        borrower={user?.borrower}
        creditLine={creditLineData}
        actionComplete={actionComplete}
        disabled={isDefaultCreditLine}
      />
    )
    creditLineStatus = (
      <CreditLinesList
        creditLine={creditLineData}
        user={user}
        changeCreditLine={changeCreditLine}
        disabled={isDefaultCreditLine}
      />
    )
  } else {
    creditActionsContainer = (
      <CreditActionsContainer
        borrower={user?.borrower}
        creditLine={creditLineData}
        actionComplete={actionComplete}
        disabled={isDefaultCreditLine}
      />
    )
    creditLineStatus = <CreditStatus creditLine={creditLineData} user={user} disabled={isDefaultCreditLine} />
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
      <ConnectionNotice creditLine={creditLineData} requireUnlock={!!user && !!user.borrower} />
      {creditActionsContainer}
      {creditLineStatus}
    </div>
  )
}

export default Borrow
