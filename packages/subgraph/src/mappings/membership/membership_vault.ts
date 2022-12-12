import {Address, BigInt} from "@graphprotocol/graph-ts"
import {AdjustedHoldings, VaultTotalUpdate, Checkpoint} from "../../../generated/MembershipVault/MembershipVault"
import {Membership, MembershipRoster} from "../../../generated/schema"

export function getOrInitMembershipRoster(): MembershipRoster {
  let membershipRoster = MembershipRoster.load("1")
  if (!membershipRoster) {
    membershipRoster = new MembershipRoster("1")
    membershipRoster.members = []
    membershipRoster.eligibleScoreTotal = BigInt.zero()
    membershipRoster.nextEpochScoreTotal = BigInt.zero()
    membershipRoster.lastCheckpointedInEpoch = BigInt.zero()
  }
  return membershipRoster
}

function getOrInitMembership(memberAddress: Address): Membership {
  let membership = Membership.load(memberAddress.toHexString())
  if (!membership) {
    membership = new Membership(memberAddress.toHexString())
    membership.user = memberAddress.toHexString()
    membership.eligibleScore = BigInt.zero()
    membership.nextEpochScore = BigInt.zero()
    membership.save()
  }
  return membership
}

export function handleAdjustedHoldings(event: AdjustedHoldings): void {
  const membership = getOrInitMembership(event.params.owner)
  membership.eligibleScore = event.params.eligibleAmount
  membership.nextEpochScore = event.params.nextEpochAmount
  membership.save()

  const membershipRoster = getOrInitMembershipRoster()
  if (!membershipRoster.members.includes(membership.id)) {
    membershipRoster.members = membershipRoster.members.concat([membership.id])
    membershipRoster.save()
    // TODO maybe some logic here to remove someone from the member roster if their score becomes 0
  }
}

export function handleVaultTotalUpdate(event: VaultTotalUpdate): void {
  const membershipRoster = getOrInitMembershipRoster()
  membershipRoster.eligibleScoreTotal = event.params.eligibleAmount
  membershipRoster.nextEpochScoreTotal = event.params.nextEpochAmount
  membershipRoster.save()
}

const MEMBERSHIP_EPOCH_SECONDS = BigInt.fromI32(604800)
function getEpochFromTimestamp(timestamp: BigInt): BigInt {
  return timestamp.div(MEMBERSHIP_EPOCH_SECONDS)
}

export function handleCheckpoint(event: Checkpoint): void {
  const membershipRoster = getOrInitMembershipRoster()
  const currentEpoch = getEpochFromTimestamp(event.block.timestamp)
  if (membershipRoster.lastCheckpointedInEpoch.equals(currentEpoch)) {
    return
  }
  membershipRoster.lastCheckpointedInEpoch = currentEpoch
  // If this is the first checkpointing of the new epoch, rotate all the eligibleScores of members
  for (let i = 0; i < membershipRoster.members.length; i++) {
    const membership = Membership.load(membershipRoster.members[i])
    if (!membership) {
      continue
    }
    membership.eligibleScore = membership.nextEpochScore
    membership.save()
  }
  membershipRoster.eligibleScoreTotal = membershipRoster.nextEpochScoreTotal
  membershipRoster.save()
}
