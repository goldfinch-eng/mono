import { gql, useApolloClient } from "@apollo/client";
import clsx from "clsx";
import { format, formatDistanceStrict } from "date-fns";
import { BigNumber, FixedNumber } from "ethers";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button, Form, Icon } from "@/components/design-system";
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

export const GRANT_CARD_GRANT_FIELDS = gql`
  fragment GrantCardGrantFields on GfiGrant {
    id
    index
    source
    reason
    proof
    amount
    vestingLength
    vestingInterval
    cliffLength
    start
    end
    vested
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

export type GrantWithToken = GrantCardGrantFieldsFragment & {
  token?: GrantCardTokenFieldsFragment;
};

interface GrantCardProps {
  grant: GrantWithToken;
}

export function GrantCard({ grant }: GrantCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const locked = grant.amount.sub(grant.vested);
  const unlocked = grant.amount.sub(locked);
  const claimable = grant.vested.sub(grant.token?.totalClaimed ?? 0);
  return (
    <div className="rounded-xl bg-sand-100 py-4 px-6">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "1fr 20% 20% 25%",
          alignItems: "center",
        }}
      >
        <div>
          <div className="mb-1.5 text-xl font-medium">
            {getReasonLabel(grant.reason)}
          </div>
          <div className="text-sand-700">
            {formatCrypto(
              {
                token: SupportedCrypto.Gfi,
                amount: grant.amount,
              },
              { includeToken: true }
            )}{" "}
            - {format(TOKEN_LAUNCH_TIME * 1000, "MMM d, y")}
          </div>
        </div>
        <div className="justify-self-end text-xl text-sand-500">
          {formatCrypto({ token: SupportedCrypto.Gfi, amount: locked })}
        </div>
        <div className="justify-self-end text-xl font-medium text-sand-700">
          {formatCrypto({
            token: SupportedCrypto.Gfi,
            amount: claimable,
          })}
        </div>
        <div className="flex items-center justify-self-end">
          <GrantButton grant={grant} claimable={claimable} locked={locked} />
          <button onClick={() => setIsExpanded(!isExpanded)} className="mx-8">
            <Icon
              name="ChevronDown"
              size="lg"
              className={clsx(
                "transition-transform",
                isExpanded ? "rotate-180" : null
              )}
            />
          </button>
        </div>
      </div>
      {isExpanded ? (
        <>
          <hr className="my-6 border-t border-sand-300" />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Detail
              heading="Transaction details"
              body={displayGrantDescription(grant.amount, grant.reason)}
            />
            <Detail
              heading="Unlock schedule"
              body={
                !grant.cliffLength
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
                grant.token
                  ? displayClaimedStatus(grant.token.totalClaimed, grant.vested)
                  : "Unclaimed"
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Detail({ heading, body }: { heading: string; body: string }) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-sand-600">{heading}</div>
      <div className="text-lg font-medium text-sand-700">{body}</div>
    </div>
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

function displayUnlockSchedule(
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

function displayUnlockedProgress(
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

function displayClaimedStatus(claimed: BigNumber, unlocked: BigNumber): string {
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
  claimable,
  locked,
}: {
  grant: GrantWithToken;
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
    ? !grant.token
      ? "Accept"
      : "Claim GFI"
    : "Claim GFI";

  const communityRewardsContract = useContract("CommunityRewards");
  const merkleDistributorContract = useContract("MerkleDistributor");
  const backerMerkleDistributorContract = useContract(
    "BackerMerkleDistributor"
  );

  const handleAction = async () => {
    if (
      !communityRewardsContract ||
      !merkleDistributorContract ||
      !backerMerkleDistributorContract
    ) {
      return;
    }
    if (grant.source === GrantSource.MerkleDistributor) {
      if (!grant.token) {
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
        const transaction = communityRewardsContract.getReward(grant.token.id);
        await toastTransaction({ transaction });
      }
    } else if (grant.source === GrantSource.BackerMerkleDistributor) {
      if (!grant.token) {
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
        const transaction = communityRewardsContract.getReward(grant.token.id);
        await toastTransaction({ transaction });
      }
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
