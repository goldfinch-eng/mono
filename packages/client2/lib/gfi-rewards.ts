import type { CommunityRewardsToken } from "@/lib/graphql/generated";

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
  | "MERKLE_DISTRIBUTOR"
  | "BACKER_MERKLE_DISTRIBUTOR"
  | "MERKLE_DIRECT_DISTRIBUTOR"
  | "BACKER_MERKLE_DIRECT_DISTRIBUTOR";

export type GrantWithSource = GrantManifest["grants"][number] & {
  source: KnownGrantSource;
};

export type GrantWithToken = GrantWithSource & {
  token?: Omit<CommunityRewardsToken, "user">;
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
