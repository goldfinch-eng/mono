import { BigNumber } from "ethers";

import type {
  DirectGfiGrant,
  IndirectGfiGrant,
  CommunityRewardsToken,
  GrantReason,
  DirectGrantSource,
  IndirectGrantSource,
  PoolToken,
  SeniorPoolStakedPosition,
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
  CONTRIBUTOR: "Goldfinch Contributor",
  ADVISOR: "Goldfinch Advisor",
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

type GfiGrant =
  | Required<
      Pick<
        IndirectGfiGrant,
        "__typename" | "indirectSource" | "index" | "amount" | "vested"
      >
    >
  | Required<Pick<DirectGfiGrant, "__typename" | "isAccepted" | "amount">>;

export function stitchGrantsWithTokens<
  G extends GfiGrant,
  C extends Pick<CommunityRewardsToken, "source" | "index" | "totalClaimed">
>(
  gfiGrants: G[],
  communityRewardsTokens: C[]
): { grant: G; token?: C; locked: BigNumber; claimable: BigNumber }[] {
  const grantsWithTokens = [];
  for (const grant of gfiGrants) {
    const correspondingToken = communityRewardsTokens.find(
      (token) =>
        grant.__typename === "IndirectGfiGrant" &&
        token.source.toString() === grant.indirectSource.toString() &&
        token.index === grant.index
    );
    grantsWithTokens.push({
      grant: grant,
      token: correspondingToken,
      locked:
        grant.__typename === "DirectGfiGrant"
          ? BigNumber.from(0)
          : grant.amount.sub(grant.vested),
      claimable:
        grant.__typename === "DirectGfiGrant"
          ? grant.isAccepted
            ? BigNumber.from(0)
            : grant.amount
          : grant.vested.sub(correspondingToken?.totalClaimed ?? 0),
    });
  }
  return grantsWithTokens;
}

export function sumTotalClaimable(
  grantsWithTokens: ReturnType<typeof stitchGrantsWithTokens> = [],
  tranchedPoolTokens: Pick<
    PoolToken,
    "rewardsClaimable" | "stakingRewardsClaimable"
  >[] = [],
  seniorPoolStakedPositions: Pick<SeniorPoolStakedPosition, "claimable">[] = []
): BigNumber {
  const grantsTotalClaimable = grantsWithTokens.reduce(
    (prev, current) => prev.add(current.claimable),
    BigNumber.from(0)
  );
  const backerTotalClaimable = tranchedPoolTokens.reduce(
    (prev, current) =>
      prev.add(current.rewardsClaimable.add(current.stakingRewardsClaimable)),
    BigNumber.from(0)
  );
  const stakingTotalClaimable = seniorPoolStakedPositions.reduce(
    (prev, current) => prev.add(current.claimable),
    BigNumber.from(0)
  );

  return grantsTotalClaimable
    .add(backerTotalClaimable)
    .add(stakingTotalClaimable);
}

export function sumTotalLocked(
  grantsWithTokens: ReturnType<typeof stitchGrantsWithTokens> = [],
  seniorPoolStakedPositions: Pick<
    SeniorPoolStakedPosition,
    "granted" | "claimable" | "totalRewardsClaimed"
  >[] = []
): BigNumber {
  const grantsTotalLocked = grantsWithTokens.reduce(
    (prev, current) => prev.add(current.locked),
    BigNumber.from(0)
  );
  const stakingTotalLocked = seniorPoolStakedPositions.reduce(
    (prev, current) =>
      prev.add(
        current.granted.sub(current.claimable).sub(current.totalRewardsClaimed)
      ),
    BigNumber.from(0)
  );

  return grantsTotalLocked.add(stakingTotalLocked);
}
