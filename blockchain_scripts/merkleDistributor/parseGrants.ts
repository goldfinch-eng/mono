import {BigNumber, utils} from "ethers"
import _ from "lodash"

import GrantTree, {AccountedGrant} from "./grantTree"

type DistributorGrantInfo = {
  index: number
  amount: string
  vestingLength: string
  cliffLength: string
  vestingInterval: string
  proof: string[]
}

// This is the blob that gets distributed.
// It is completely sufficient for recreating the entire merkle tree.
interface MerkleDistributorInfo {
  merkleRoot: string
  amountTotal: string
  grants: {
    [account: string]: DistributorGrantInfo
  }
}

export function parseGrants(unsortedGrants: AccountedGrant[]): MerkleDistributorInfo {
  const sortedGrants = _.sortBy(unsortedGrants, "address")

  // construct a tree
  const tree = new GrantTree(sortedGrants)

  // generate grants
  const grants = sortedGrants.reduce<{
    [address: string]: DistributorGrantInfo
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
