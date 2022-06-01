import BigNumber from "bignumber.js"
import {useState} from "react"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {TokenInfo} from "../../ethereum/tranchedPool"
import {displayDollars} from "../../utils"
import Dropdown from "../dropdown"
import {iconCarrotDown} from "../icons"

interface TranchedPoolWithdrawSourceDropdownProps {
  onChange: (val: string) => void
  poolTokens: TokenInfo[]
  zappedPoolTokens: TokenInfo[]
}

export default function TranchedPoolWithdrawSourceDropdown({
  onChange,
  poolTokens,
  zappedPoolTokens,
}: TranchedPoolWithdrawSourceDropdownProps) {
  const [selected, setSelected] = useState<string>("wallet")
  const dropdownOptions = getDropdownOptions(poolTokens, zappedPoolTokens)

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

/**
 * Returns dropdown options for withdrawing funds. The first option is always the total
 * combined source of funds from the pool tokens owned by the user. These pool tokens come
 * from direct deposits and can be withdrawn all at once via withdrawMultiple. As of writing
 * (05/17/22) Zapper doesn't have an equivalent "unzapMultiple" function, so there has to
 * be a separate option for each one.
 * @param poolTokens list of pool tokens owned by the user
 * @param zappedPoolTokens list of pool tokens owned by the Zapper that were zapped by the user
 */
function getDropdownOptions(poolTokens: TokenInfo[], zappedPoolTokens: TokenInfo[]) {
  const totalAmountDepositedThroughPoolTokens = poolTokens
    .map((poolToken) => poolToken.principalRedeemable.plus(poolToken.interestRedeemable))
    .reduce((redeemableAmount1, redeemableAmount2) => redeemableAmount1.plus(redeemableAmount2), new BigNumber(0))

  const depositTokenOptions = [
    {
      value: "wallet",
      el: <span>Wallet - {displayDollars(usdcFromAtomic(totalAmountDepositedThroughPoolTokens))}</span>,
    },
  ]

  const zappedTokenOptions = zappedPoolTokens.map((poolToken, i) => {
    const maxUnzapAmount = poolToken.interestRedeemable.plus(poolToken.principalRedeemable)
    return {
      value: poolToken.id,
      el: <span>Senior Pool capital - {displayDollars(usdcFromAtomic(maxUnzapAmount))}</span>,
    }
  })

  const allDropdownOptions = depositTokenOptions.concat(zappedTokenOptions)
  return allDropdownOptions
}
