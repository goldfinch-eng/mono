import BigNumber from "bignumber.js"
import {useState} from "react"
import {fiduInDollars, fiduToDollarsAtomic} from "../../ethereum/fidu"
import {StakingRewardsPosition} from "../../ethereum/pool"
import {displayDollars} from "../../utils"
import Dropdown from "../dropdown"
import {iconCarrotDown} from "../icons"

interface TranchedPoolDepositSourceDropwdownProps {
  onChange: (val: string) => void
  walletAddress: string
  sharePrice: BigNumber
  stakedFiduPositions: StakingRewardsPosition[]
}

export default function TranchedPoolDepositSourceDropdown({
  onChange,
  walletAddress,
  sharePrice,
  stakedFiduPositions,
}: TranchedPoolDepositSourceDropwdownProps) {
  const [selected, setSelected] = useState<string>("wallet")
  const dropdownOptions = getDropdownOptions(walletAddress, sharePrice, stakedFiduPositions)

  return (
    <Dropdown
      className={"tranched-pool-deposit-source-dropdown transaction-input-multisource"}
      selected={selected}
      options={dropdownOptions}
      onSelect={(val) => {
        setSelected(val)
        onChange(val)
      }}
      arrow={iconCarrotDown}
    />
  )
}

function getDropdownOptions(
  walletAddress: string,
  sharePrice: BigNumber,
  stakedFiduPositions: StakingRewardsPosition[]
) {
  const walletOptions = [
    {
      value: "wallet",
      el: <span>Wallet - {walletAddress.slice(0, 10)}</span>,
    },
  ]

  const fiduPositionOptions = stakedFiduPositions.map((position, i) => {
    const usdcBalance = fiduToDollarsAtomic(fiduInDollars(position.storedPosition.amount), sharePrice)
    return {
      value: position.tokenId,
      el: (
        <span>
          Position {i + 1} - {displayDollars(usdcBalance)}
        </span>
      ),
    }
  })
  const allOptions = walletOptions.concat(fiduPositionOptions)
  return allOptions
}
