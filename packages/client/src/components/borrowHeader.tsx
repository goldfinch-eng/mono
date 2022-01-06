import React, {useState, useEffect, useContext} from "react"
import {fetchCreditLineData} from "../ethereum/creditLine"
import {usdcFromAtomic} from "../ethereum/erc20"
import {assertNonNullable, displayDollars} from "../utils"
import Dropdown from "./dropdown"
import {AppContext} from "../App"

function BorrowHeader(props): JSX.Element {
  const {goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [creditLinePreviews, setCreditLinePreviews] = useState([])

  useEffect(() => {
    async function getCreditLinePreviews() {
      let creditLines = []
      if (props.creditLinesAddresses.length > 1) {
        assertNonNullable(goldfinchProtocol)
        assertNonNullable(currentBlock)
        const multipleCreditLines = await fetchCreditLineData(
          props.creditLinesAddresses,
          goldfinchProtocol,
          currentBlock
        )
        if (multipleCreditLines.creditLines.length > 1) {
          // If there are multiple credit lines, we nee dto show the Multiple creditlines first (the "All" option), and
          // then each of the individual credit lines
          // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
          creditLines = [multipleCreditLines, ...multipleCreditLines.creditLines]
        } else {
          // In some cases multiple credit lines can only have a single active creditline (e.g. an old creditline
          // that has a 0 limit). In this case, treat it as a single credit line.
          creditLines = multipleCreditLines.creditLines
        }
      } else {
        // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
        creditLines = [await fetchCreditLineData(props.creditLinesAddresses, goldfinchProtocol, currentBlock)]
      }
      setCreditLinePreviews(creditLines)
    }
    getCreditLinePreviews()
  }, [goldfinchProtocol, props.creditLinesAddresses, currentBlock])

  if (props.creditLinesAddresses.length > 1) {
    const options = creditLinePreviews.map((cl) => {
      return {
        value: (cl as any).address,
        selectedEl: <>{(cl as any).name}</>,
        el: (
          <>
            {(cl as any).name}
            <span className="dropdown-amount">{displayDollars(usdcFromAtomic((cl as any).limit))}</span>
          </>
        ),
      }
    })

    return (
      <div>
        <span>Credit Line /</span>
        <Dropdown
          selected={props.selectedCreditLine.address}
          options={options}
          onSelect={(address) => {
            props.changeCreditLine(address)
          }}
        />
      </div>
    )
  }

  let header = "Loading..."
  if (props.user && props.selectedCreditLine.address) {
    header = `Credit Line / ${props.selectedCreditLine.name}`
  } else if (props.user) {
    header = "Credit Line"
  }
  return <>{header}</>
}

export default BorrowHeader
