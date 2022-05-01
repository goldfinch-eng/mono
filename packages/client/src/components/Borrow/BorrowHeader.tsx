import React, {useState, useEffect, useContext} from "react"
import {CreditLine, fetchCreditLineData, MultipleCreditLines} from "../../ethereum/creditLine"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {assertNonNullable, BlockInfo, displayDollars} from "../../utils"
import Dropdown from "../dropdown"
import {AppContext} from "../../App"
import {UserLoaded} from "../../ethereum/user"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"

type BorrowHeaderProps = {
  user: UserLoaded | undefined
  creditLinesAddresses: string[]
  selectedCreditLine: CreditLine | undefined
  changeCreditLine: (clAddress: string) => void
}

function BorrowHeader(props: BorrowHeaderProps): JSX.Element {
  const {goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [creditLinePreviews, setCreditLinePreviews] = useState<Array<CreditLine | MultipleCreditLines>>([])

  useEffect(() => {
    async function getCreditLinePreviews(goldfinchProtocol: GoldfinchProtocol, currentBlock: BlockInfo) {
      let creditLines: Array<CreditLine | MultipleCreditLines> = []
      if (props.creditLinesAddresses.length > 1) {
        const multipleCreditLines = await fetchCreditLineData(
          props.creditLinesAddresses,
          goldfinchProtocol,
          currentBlock
        )
        assertNonNullable(multipleCreditLines)
        if (multipleCreditLines.creditLines.length > 1) {
          // If there are multiple credit lines, we need to show the Multiple creditlines first (the "All" option), and
          // then each of the individual credit lines
          creditLines = [multipleCreditLines, ...multipleCreditLines.creditLines]
        } else {
          // In some cases multiple credit lines can only have a single active creditline (e.g. an old creditline
          // that has a 0 limit). In this case, treat it as a single credit line.
          creditLines = multipleCreditLines.creditLines
        }
      } else {
        const creditLine = await fetchCreditLineData(props.creditLinesAddresses, goldfinchProtocol, currentBlock)
        creditLines = creditLine ? [creditLine] : []
      }
      setCreditLinePreviews(creditLines)
    }
    if (goldfinchProtocol && currentBlock) {
      getCreditLinePreviews(goldfinchProtocol, currentBlock)
    }
  }, [goldfinchProtocol, props.creditLinesAddresses, currentBlock])

  if (props.creditLinesAddresses.length > 1 && props.selectedCreditLine && creditLinePreviews.length) {
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
  if (props.user && props.selectedCreditLine) {
    header = `Credit Line / ${props.selectedCreditLine.name}`
  } else if (props.user) {
    header = "Credit Line"
  }
  return <>{header}</>
}

export default BorrowHeader
