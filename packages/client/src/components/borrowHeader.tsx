import React, {useState, useEffect, useContext} from "react"
import {fetchCreditLineData} from "../ethereum/creditLine"
import {usdcFromAtomic} from "../ethereum/erc20"
import {assertNonNullable, displayDollars} from "../utils"
import Dropdown from "./dropdown"
import {AppContext} from "../App"

function BorrowHeader(props): JSX.Element {
  const {goldfinchProtocol} = useContext(AppContext)
  const [creditLinePreviews, setCreditLinePreviews] = useState([])

  useEffect(() => {
    async function getCreditLinePreviews() {
      let creditLines = []
      if (props.creditLinesAddresses.length > 1) {
        assertNonNullable(goldfinchProtocol)
        const multipleCreditLines = await fetchCreditLineData(props.creditLinesAddresses, goldfinchProtocol)
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
        creditLines = [await fetchCreditLineData(props.creditLinesAddresses, goldfinchProtocol)]
      }
      setCreditLinePreviews(creditLines)
    }
    getCreditLinePreviews()
  }, [goldfinchProtocol, props.creditLinesAddresses])

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
        {/* @ts-expect-error ts-migrate(2739) FIXME: Type '{ selected: any; options: { value: any; sele... Remove this comment to see the full error message */}
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
  if (props.user.loaded && props.selectedCreditLine.address) {
    header = `Credit Line / ${props.selectedCreditLine.name}`
  } else if (props.user.loaded) {
    header = "Credit Line"
  }
  return <>{header}</>
}

export default BorrowHeader
