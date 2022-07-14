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

export type KnownGrantSource =
  | "merkle"
  | "backerMerkle"
  | "merkleDirect"
  | "backerMerkleDirect";

export type GrantWithSource = GrantManifest["grants"][number] & {
  source: KnownGrantSource;
};

type Reason =
  | "backer"
  | "liquidity_provider"
  | "flight_academy"
  | "flight_academy_and_liquidity_provider";

const reasonLabels: Record<Reason, string> = {
  backer: "Backer",
  liquidity_provider: "Liquidity Provider",
  flight_academy: "Flight Academy",
  flight_academy_and_liquidity_provider:
    "Flight Academy and Liquidity Provider",
};

export function getReasonLabel(reason: string) {
  return reasonLabels[reason as Reason] ?? reason;
}
