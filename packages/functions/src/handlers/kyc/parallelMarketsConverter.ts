import {PmAccreditationStatus} from "../parallelmarkets/PmApiTypes"
import {KycStatus} from "./kycTypes"

const ParallelMarketsStatuses: Record<PmAccreditationStatus, KycStatus> = {
  current: "current",
  pending: "pending",
  submitter_pending: "pending",
  third_party_pending: "pending",
  expired: "expired",
  rejected: "rejected",
}

export const getAccreditationStatus = (statuses: {status: PmAccreditationStatus}[]): KycStatus | undefined => {
  const kycStatuses = new Set(statuses.map((accr) => accr.status).map((status) => ParallelMarketsStatuses[status]))

  for (const kycStatus of ["current", "pending", "expired", "rejected"] as KycStatus[]) {
    if (kycStatuses.has(kycStatus)) return kycStatus
  }

  return undefined
}
