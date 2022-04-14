import BigNumber from "bignumber.js"
import React from "react"
import {getUsdcAmountNetOfProtocolFee, usdcFromAtomic} from "../../ethereum/erc20"
import {gfiFromAtomic, gfiInDollars, gfiToDollarsAtomic} from "../../ethereum/gfi"
import {CapitalProvider} from "../../ethereum/pool"
import {displayDollars, displayNumber} from "../../utils"

interface ForfeitGfiNotesProps {
  withdrawalUsdcDisplayAmount: BigNumber
  forfeitedGfi: BigNumber
  capitalProvider: CapitalProvider
}

export default function ForfeitGfiNotes(props: ForfeitGfiNotesProps) {
  return (
    <p>
      You will{" "}
      <span className="font-bold">
        receive {displayDollars(usdcFromAtomic(getUsdcAmountNetOfProtocolFee(props.withdrawalUsdcDisplayAmount)), 2)}{" "}
      </span>
      net of protocol reserves and{" "}
      <span className="font-bold">
        forfeit {displayNumber(gfiFromAtomic(props.forfeitedGfi), 2)} GFI (
        {displayDollars(gfiInDollars(gfiToDollarsAtomic(props.forfeitedGfi, props.capitalProvider.gfiPrice)), 2)}){" "}
      </span>
      that is still locked.
    </p>
  )
}
