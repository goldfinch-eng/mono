import {assertNonNullable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {useContext} from "react"
import {AppContext} from "../App"
import {Ticker} from "../ethereum/erc20"
import {useFromSameBlock} from "./useFromSameBlock"
import useSendFromUser from "./useSendFromUser"

export default function useApprove() {
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
      ? sendFromUser(
          token.contract.userWallet.methods.approve(spender, amount.toString(10)),
          {
            type: token.approvalTxType,
            data: {
              amount: token.atomicAmount(amount),
            },
          },
          {rejectOnError: true}
        )
      : Promise.resolve()
  }

  return approveIfNeeded
}
