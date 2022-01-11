import {BigNumber} from "ethers"
import _ from "lodash"

import GrantTree from "./grantTree"
import {AccountedDirectGrant, MerkleDirectDistributorGrantInfo, MerkleDirectDistributorInfo} from "./types"

export function parseGrants(unsortedGrants: AccountedDirectGrant[]): MerkleDirectDistributorInfo {
  const sortedGrants = _.sortBy(unsortedGrants, [(grant) => grant.account, (grant) => grant.grant.amount])

  const tree = new GrantTree(sortedGrants)

  const grants = sortedGrants.map(
    (accountedGrant: AccountedDirectGrant, index: number): MerkleDirectDistributorGrantInfo => ({
      index,
      account: accountedGrant.account,
      reason: accountedGrant.reason,
      grant: {
        amount: accountedGrant.grant.amount.toHexString(),
      },
      proof: tree.getProof(index, accountedGrant.account, accountedGrant.grant),
    })
  )

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
