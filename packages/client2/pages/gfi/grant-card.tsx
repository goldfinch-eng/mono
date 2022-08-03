import { gql, useApolloClient } from "@apollo/client";
import { format, formatDistanceStrict } from "date-fns";
import { BigNumber, FixedNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Button, Form } from "@/components/design-system";
import { TOKEN_LAUNCH_TIME } from "@/constants";
import { useContract } from "@/lib/contracts";
import { formatCrypto, formatPercent } from "@/lib/format";
import { getReasonLabel } from "@/lib/gfi-rewards";
import {
  SupportedCrypto,
  GrantCardGrantFieldsFragment,
  GrantCardTokenFieldsFragment,
  GrantReason,
  GrantSource,
} from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";

import { RewardCardScaffold, Detail } from "./reward-card-scaffold";

export const GRANT_CARD_GRANT_FIELDS = gql`
  fragment GrantCardGrantFields on GfiGrant {
    __typename
    id
    index
    reason
    proof
    amount

    ... on IndirectGfiGrant {
      source
      vestingLength
      vestingInterval
      cliffLength
      start
      end
      vested
    }

    ... on DirectGfiGrant {
      source
      isAccepted
    }
  }
`;

export const GRANT_CARD_TOKEN_FIELDS = gql`
  fragment GrantCardTokenFields on CommunityRewardsToken {
    id
    index
    source
    totalGranted
    totalClaimed
    grantedAt
    revokedAt
  }
`;

interface GrantCardProps {
  grant: GrantCardGrantFieldsFragment;
  token?: GrantCardTokenFieldsFragment;
  claimable: BigNumber;
  locked: BigNumber;
}

export function GrantCard({ grant, token, claimable, locked }: GrantCardProps) {
  const unlocked = grant.amount.sub(locked);

  return (
    <RewardCardScaffold
      heading={getReasonLabel(grant.reason)}
      subheading={`${formatCrypto(
        {
          token: SupportedCrypto.Gfi,
          amount: grant.amount,
        },
        { includeToken: true }
      )} - ${format(TOKEN_LAUNCH_TIME * 1000, "MMM d, y")}`}
      fadedAmount={formatCrypto({ token: SupportedCrypto.Gfi, amount: locked })}
      boldedAmount={formatCrypto({
        token: SupportedCrypto.Gfi,
        amount: claimable,
      })}
      action={
        <GrantButton
          grant={grant}
          token={token}
          claimable={claimable}
          locked={locked}
        />
      }
      expandedDetails={
        <>
          <Detail
            heading="Transaction details"
            body={displayGrantDescription(grant.amount, grant.reason)}
          />
          <Detail
            heading="Unlock schedule"
            body={
              grant.__typename === "DirectGfiGrant"
                ? "Immediate"
                : displayUnlockSchedule(grant.cliffLength, grant.end)
            }
          />
          <Detail
            heading="Unlock status"
            body={displayUnlockedProgress(grant.amount, unlocked)}
          />
          <Detail
            heading="Claim status"
            body={
              grant.__typename === "DirectGfiGrant"
                ? grant.isAccepted
                  ? "Claimed"
                  : "Unclaimed"
                : token
                ? displayClaimedStatus(token.totalClaimed, grant.vested)
                : "Unclaimed"
            }
          />
        </>
      }
    />
  );
}

const descriptionMapping: Record<GrantReason, string> = {
  [GrantReason.FlightAcademy]: "participating in Flight Academy",
  [GrantReason.FlightAcademyAndLiquidityProvider]:
    "participating in Flight Academy and as Liquidity Provider",
  [GrantReason.Backer]: "participating as a Backer",
  [GrantReason.LiquidityProvider]: "participating as a Liquidity Provider",
  [GrantReason.GoldfinchInvestment]: "participating as a Goldfinch investor",
};

function displayGrantDescription(
  amount: BigNumber,
  reason: GrantReason
): string {
  const displayAmount = formatCrypto(
    { amount, token: SupportedCrypto.Gfi },
    { includeToken: true }
  );
  return `${displayAmount} for ${descriptionMapping[reason]}`;
}

export function displayUnlockSchedule(
  cliffLength: BigNumber,
  endTime: BigNumber
): string {
  const cliffLengthDisplay =
    cliffLength.toString() === "0"
      ? ""
      : `, with ${formatDistanceStrict(cliffLength.toNumber() * 1000, 0, {
          unit: "month",
        }).replace("months", "month")} cliff,`;

  return `Linear${cliffLengthDisplay} until 100% on ${format(
    endTime.toNumber() * 1000,
    "MMM d, y"
  )}`;
}

export function displayUnlockedProgress(
  totalAmount: BigNumber,
  unlocked: BigNumber
): string {
  const totalAmountAsFixed = FixedNumber.fromValue(totalAmount);
  const unlockedAsFixed = FixedNumber.fromValue(unlocked);

  return `${formatPercent(
    unlockedAsFixed.divUnsafe(totalAmountAsFixed)
  )} (${formatCrypto(
    { token: SupportedCrypto.Gfi, amount: unlocked },
    { includeToken: true }
  )}) unlocked`;
}

export function displayClaimedStatus(
  claimed: BigNumber,
  unlocked: BigNumber
): string {
  const formattedClaimed = formatCrypto(
    { token: SupportedCrypto.Gfi, amount: claimed },
    { includeToken: true }
  );
  const formattedUnlocked = formatCrypto(
    { token: SupportedCrypto.Gfi, amount: unlocked },
    { includeToken: true }
  );

  return `${formattedClaimed} claimed of your total unlocked ${formattedUnlocked}`;
}

function GrantButton({
  grant,
  token,
  claimable,
  locked,
}: {
  grant: GrantCardGrantFieldsFragment;
  token?: GrantCardTokenFieldsFragment;
  claimable: BigNumber;
  locked: BigNumber;
}) {
  const rhfMethods = useForm();
  const apolloClient = useApolloClient();

  const message = claimable.isZero()
    ? locked.isZero()
      ? "Claimed"
      : "Still Locked"
    : grant.source === GrantSource.MerkleDistributor ||
      grant.source === GrantSource.BackerMerkleDistributor
    ? !token
      ? "Accept"
      : "Claim GFI"
    : "Claim GFI";

  const communityRewardsContract = useContract("CommunityRewards");
  const merkleDistributorContract = useContract("MerkleDistributor");
  const backerMerkleDistributorContract = useContract(
    "BackerMerkleDistributor"
  );
  const merkleDirectDistributorContract = useContract(
    "MerkleDirectDistributor"
  );
  const backerMerkleDirectDistributorContract = useContract(
    "BackerMerkleDirectDistributor"
  );

  const handleAction = async () => {
    if (
      !communityRewardsContract ||
      !merkleDistributorContract ||
      !backerMerkleDistributorContract ||
      !merkleDirectDistributorContract ||
      !backerMerkleDirectDistributorContract
    ) {
      return;
    }
    if (
      grant.__typename === "IndirectGfiGrant" &&
      grant.source === GrantSource.MerkleDistributor
    ) {
      if (!token) {
        const transaction = merkleDistributorContract.acceptGrant(
          grant.index,
          grant.amount,
          grant.vestingLength,
          grant.cliffLength,
          grant.vestingInterval,
          grant.proof
        );
        await toastTransaction({ transaction });
      } else {
        const transaction = communityRewardsContract.getReward(token.id);
        await toastTransaction({ transaction });
      }
    } else if (
      grant.__typename === "IndirectGfiGrant" &&
      grant.source === GrantSource.BackerMerkleDistributor
    ) {
      if (!token) {
        const transaction = backerMerkleDistributorContract.acceptGrant(
          grant.index,
          grant.amount,
          grant.vestingLength,
          grant.cliffLength,
          grant.vestingInterval,
          grant.proof
        );
        await toastTransaction({ transaction });
      } else {
        const transaction = communityRewardsContract.getReward(token.id);
        await toastTransaction({ transaction });
      }
    } else if (grant.source === GrantSource.MerkleDirectDistributor) {
      const transaction = merkleDirectDistributorContract.acceptGrant(
        grant.index,
        grant.amount,
        grant.proof
      );
      await toastTransaction({ transaction });
    } else if (grant.source === GrantSource.BackerMerkleDirectDistributor) {
      const transaction = backerMerkleDirectDistributorContract.acceptGrant(
        grant.index,
        grant.amount,
        grant.proof
      );
      await toastTransaction({ transaction });
    } else {
      throw new Error(
        `Unimplemented grant source when trying to accept: ${grant.source}`
      );
    }
    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <Form rhfMethods={rhfMethods} onSubmit={handleAction}>
      <Button size="lg" type="submit" disabled={claimable.isZero()}>
        {message}
      </Button>
    </Form>
  );
}
