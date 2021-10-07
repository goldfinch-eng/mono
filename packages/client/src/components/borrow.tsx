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
  const {creditDesk, user, goldfinchProtocol} = useContext(AppContext)
  const [creditLinesAddresses, setCreditLinesAddresses] = useState([])
  const [creditLine, setCreditLine] = useState(defaultCreditLine)
  const {borrowStore, setBorrowStore} = useBorrow()

  async function updateBorrowerAndCreditLine() {
    const borrower = (user as any).borrower
    if (borrower && creditDesk.loaded) {
      const borrowerCreditLines = borrower.creditLinesAddresses
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

  useEffect(() => {
    if (creditLine.name !== "No Credit Lines") {
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
    setCreditLine(await fetchCreditLineData(clAddresses, goldfinchProtocol))
  }

  let creditActionsContainer
  let creditLineStatus
  if (creditLineData.isMultiple) {
    creditActionsContainer = (
      <CreditActionsMultipleContainer
        borrower={(user as any).borrower}
        creditLine={creditLineData}
        actionComplete={actionComplete}
      />
    )
    creditLineStatus = <CreditLinesList creditLine={creditLineData} user={user} changeCreditLine={changeCreditLine} />
  } else {
    creditActionsContainer = (
      <CreditActionsContainer
        borrower={(user as any).borrower}
        creditLine={creditLineData}
        actionComplete={actionComplete}
      />
    )
    creditLineStatus = <CreditStatus creditLine={creditLineData} user={user} />
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
      <ConnectionNotice creditLine={creditLineData} requireUnlock={!!(user as any).borrower} />
      {creditActionsContainer}
      {creditLineStatus}
    </div>
  )
}

export default Borrow
