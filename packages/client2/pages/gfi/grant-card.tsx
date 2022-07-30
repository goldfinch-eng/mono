import { gql } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { useState } from "react";

import { Button, Icon } from "@/components/design-system";
import { TOKEN_LAUNCH_TIME } from "@/constants";
import { formatCrypto } from "@/lib/format";
import { getReasonLabel } from "@/lib/gfi-rewards";
import {
  SupportedCrypto,
  GrantCardGrantFieldsFragment,
  GrantCardTokenFieldsFragment,
  GrantReason,
} from "@/lib/graphql/generated";

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
    claimable
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
  const locked = grant.amount.sub(grant.claimable);
  return (
    <div className="rounded-xl bg-sand-100 py-4 px-6">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "40% 20% 20% 20%",
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
            amount: grant.claimable,
          })}
        </div>
        <div className="flex items-center justify-self-end">
          <Button size="lg">Lorem</Button>
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
          <div className="flex gap-8">
            <Detail
              heading="Transaction details"
              body={getGrantDescription(grant.amount, grant.reason)}
            />
            <Detail
              heading="Claim status"
              body={
                grant.token
                  ? getClaimedStatus(grant.token.totalClaimed, grant.claimable)
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

function getGrantDescription(amount: BigNumber, reason: GrantReason) {
  const displayAmount = formatCrypto(
    { amount, token: SupportedCrypto.Gfi },
    { includeToken: true }
  );
  return `${displayAmount} for ${descriptionMapping[reason]}`;
}

function getClaimedStatus(claimed: BigNumber, unlocked: BigNumber) {
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
