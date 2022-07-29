import type {
  GfiGrant,
  GrantReason,
  GrantSource,
} from "@/lib/graphql/generated";

export type Grant = {
  amount: string;
  vestingLength: string;
  cliffLength: string;
  vestingInterval: string;
};

export type DirectGrant = {
  amount: string;
};

export type GrantManifest = {
  merkleRoot: string;
  amountTotal: string;
  grants: {
    index: number;
    account: string;
    reason: string;
    grant: Grant | DirectGrant;
    proof: string[];
  }[];
};

export type GrantWithSource = GrantManifest["grants"][number] & {
  source: GrantSource;
};

const reasonLabels: Record<GrantReason, string> = {
  BACKER: "Backer",
  LIQUIDITY_PROVIDER: "Liquidity Provider",
  FLIGHT_ACADEMY: "Flight Academy",
  FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER:
    "Flight Academy and Liquidity Provider",
  GOLDFINCH_INVESTMENT: "Goldfinch Investment",
};

export function getReasonLabel(reason: string) {
  return reasonLabels[reason as GrantReason] ?? reason;
}

const sourceOrdering: Record<GrantSource, number> = {
  MERKLE_DISTRIBUTOR: 0,
  MERKLE_DIRECT_DISTRIBUTOR: 1,
  BACKER_MERKLE_DISTRIBUTOR: 2,
  BACKER_MERKLE_DIRECT_DISTRIBUTOR: 3,
};

export function grantComparator(
  a: Pick<GfiGrant, "source" | "index">,
  b: Pick<GfiGrant, "source" | "index">
) {
  if (a.source !== b.source) {
    return sourceOrdering[a.source] - sourceOrdering[b.source];
  }
  return a.index - b.index;
}
