import {assertNonNullable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {useContext} from "react"
import {AppContext} from "../App"
import {Ticker} from "../ethereum/erc20"
import {MAX_UINT} from "../ethereum/utils"
import {useFromSameBlock} from "./useFromSameBlock"
import useSendFromUser from "./useSendFromUser"

export default function useERC20Approve() {
  const sendFromUser = useSendFromUser()

  const {goldfinchProtocol, user: _user, pool: _pool, currentBlock} = useContext(AppContext)

  const consistent = useFromSameBlock({setAsLeaf: false}, currentBlock, _user, _pool)
  const user = consistent?.[0]

  async function approveIfNeeded(amount: BigNumber, ticker: Ticker, spender: string) {
    assertNonNullable(user)
    assertNonNullable(goldfinchProtocol)

    const token = goldfinchProtocol.getERC20(ticker)

    const alreadyApprovedAmount = new BigNumber(
      await token.contract.userWallet.methods.allowance(user.address, spender).call(undefined, "latest")
    )
    const requiresApproval = amount.gt(alreadyApprovedAmount)

    return requiresApproval
      ? // Since we have to ask for approval, we'll ask for the max amount, so that the user will never
        // need to grant approval again (i.e. which saves them the gas cost of ever having to approve again).
        sendFromUser(
          token.contract.userWallet.methods.approve(spender, MAX_UINT),
          {
            type: token.approvalTxType,
            data: {
              amount: token.atomicAmount(MAX_UINT),
            },
          },
          {rejectOnError: true}
        )
      : Promise.resolve()
  }

  return approveIfNeeded
}
