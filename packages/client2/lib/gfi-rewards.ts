import type {
  DirectGfiGrant,
  IndirectGfiGrant,
  GrantReason,
  DirectGrantSource,
  IndirectGrantSource,
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
  source: DirectGrantSource | IndirectGrantSource;
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

const sourceOrdering: Record<IndirectGrantSource | DirectGrantSource, number> =
  {
    MERKLE_DISTRIBUTOR: 0,
    MERKLE_DIRECT_DISTRIBUTOR: 1,
    BACKER_MERKLE_DISTRIBUTOR: 2,
    BACKER_MERKLE_DIRECT_DISTRIBUTOR: 3,
  };

type I = Required<
  Pick<IndirectGfiGrant, "__typename" | "indirectSource" | "index">
>;
type D = Required<
  Pick<DirectGfiGrant, "__typename" | "directSource" | "index">
>;

export function grantComparator(a: I | D, b: I | D) {
  const aSource =
    a.__typename === "IndirectGfiGrant" ? a.indirectSource : a.directSource;
  const bSource =
    b.__typename === "IndirectGfiGrant" ? b.indirectSource : b.directSource;

  if (aSource !== bSource) {
    return sourceOrdering[aSource] - sourceOrdering[bSource];
  }
  return a.index - b.index;
}
