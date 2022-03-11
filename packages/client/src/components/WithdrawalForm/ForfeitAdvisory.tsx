import React from "react"
import {gfiFromAtomic} from "../../ethereum/gfi"
import {CapitalProvider} from "../../ethereum/pool"
import {displayDollars, displayNumber} from "../../utils"

interface ForfeitAdvisoryProps {
  capitalProvider: CapitalProvider
}

export default function ForfeitAdvisory(props: ForfeitAdvisoryProps) {
  // NOTE: `capitalProvider.rewardsInfo` reflects unvested rewards from *all* positions,
  // including any locked positions. Even though our UI doesn't enable using lock-up, it seems
  // appropriate to use unvested rewards info here from all positions (rather than only the
  // unstakeable positions), because (1) that does not impact correctness of the calculation
  // of how much would be forfeited for the user's intended withdrawal amount; and (2) that amount
  // of unvested rewards corresponds to what's shown as the "Locked" amount on the GFI
  // page.
  const lastVestingEnd = props.capitalProvider.rewardsInfo.hasUnvested
    ? new Date(props.capitalProvider.rewardsInfo.lastVestingEndTime * 1000)
    : undefined

  return (
    <div className="form-message paragraph">
      You have{" "}
      {props.capitalProvider.rewardsInfo.unvested &&
        displayNumber(gfiFromAtomic(props.capitalProvider.rewardsInfo.unvested), 2)}{" "}
      GFI (
      {props.capitalProvider.rewardsInfo.unvestedInDollars &&
        displayDollars(props.capitalProvider.rewardsInfo.unvestedInDollars, 2)}
      ) that is still locked until{" "}
      {lastVestingEnd!.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}
      . If you withdraw before then, you {props.capitalProvider.shares.parts.notStaked.gt(0) ? "might" : "will"} forfeit
      a portion of your locked GFI.
    </div>
  )
}
