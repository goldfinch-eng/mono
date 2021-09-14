import {BigNumber} from "ethers"
import _ from "lodash"

import GrantTree from "./grantTree"
import { AccountedGrant, MerkleDistributorGrantInfo, MerkleDistributorInfo } from "./types"

export function parseGrants(unsortedGrants: AccountedGrant[]): MerkleDistributorInfo {
  const sortedGrants = _.sortBy(unsortedGrants, "address")

  const tree = new GrantTree(sortedGrants)

  const grants = sortedGrants.reduce<{
    [address: string]: MerkleDistributorGrantInfo
  }>((acc, accountedGrant, index) => {
    const account = accountedGrant.account
    acc[account] = {
      index,
      amount: accountedGrant.grant.amount.toHexString(),
      vestingLength: accountedGrant.grant.vestingLength.toHexString(),
      cliffLength: accountedGrant.grant.cliffLength.toHexString(),
      vestingInterval: accountedGrant.grant.vestingInterval.toHexString(),
      proof: tree.getProof(index, account, accountedGrant.grant),
    }
    return acc
  }, {})

  const amountTotal: BigNumber = sortedGrants.reduce<BigNumber>(
    (acc, accountedGrant) => acc.add(accountedGrant.grant.amount),
    BigNumber.from(0)
  )

  return {
    merkleRoot: tree.getHexRoot(),
    amountTotal: amountTotal.toHexString(),
    grants,
  }
}
