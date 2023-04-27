import {BigNumber} from "ethers"
import _ from "lodash"

import GrantTree from "./grantTree"
import {AccountedGrant, MerkleDistributorGrantInfo, MerkleDistributorInfo} from "./types"

export function parseGrants(unsortedGrants: AccountedGrant[]): MerkleDistributorInfo {
  const sortedGrants = _.sortBy(unsortedGrants, [
    (grant) => grant.account,
    (grant) => grant.grant.amount,
    (grant) => grant.grant.vestingLength,
    (grant) => grant.grant.cliffLength,
    (grant) => grant.grant.vestingInterval,
  ])

  const tree = new GrantTree(sortedGrants)

  const grants = sortedGrants.map(
    (accountedGrant: AccountedGrant, index: number): MerkleDistributorGrantInfo => ({
      index,
      account: accountedGrant.account,
      reason: accountedGrant.reason,
      grant: {
        amount: accountedGrant.grant.amount.toHexString(),
        vestingLength: accountedGrant.grant.vestingLength.toHexString(),
        cliffLength: accountedGrant.grant.cliffLength.toHexString(),
        vestingInterval: accountedGrant.grant.vestingInterval.toHexString(),
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
