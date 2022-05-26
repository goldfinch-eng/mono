import {assertNonNullable} from "@goldfinch-eng/utils"
import {useContext} from "react"
import {AppContext} from "../App"
import {ERC721_APPROVAL_TX_TYPE} from "../types/transactions"
import {useFromSameBlock} from "./useFromSameBlock"
import useSendFromUser from "./useSendFromUser"

export default function useERC721Approve() {
  const sendFromUser = useSendFromUser()

  const {user: _user, pool: _pool, currentBlock} = useContext(AppContext)

  const consistent = useFromSameBlock({setAsLeaf: false}, currentBlock, _user, _pool)
  const user = consistent?.[0]

  async function approveIfNeeded(erc721: any, spender: string) {
    assertNonNullable(user)

    const isAlreadyApproved = await erc721.contract.userWallet.methods
      .isApprovedForAll(user.address, spender)
      .call(undefined, "latest")

    return isAlreadyApproved
      ? Promise.resolve() // Since we have to ask for approval, we'll ask for approval for all, so that the user will never
      : // need to grant approval again (i.e. which saves them the gas cost of ever having to approve again).
        sendFromUser(
          erc721.contract.userWallet.methods.setApprovalForAll(spender, true),
          {
            type: ERC721_APPROVAL_TX_TYPE,
            data: {
              erc721,
            },
          },
          {rejectOnError: true}
        )
  }

  return approveIfNeeded
}
