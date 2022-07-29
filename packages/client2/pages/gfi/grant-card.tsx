import { gql } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";

import { TOKEN_LAUNCH_TIME } from "@/constants";
import { formatCrypto } from "@/lib/format";
import { getReasonLabel } from "@/lib/gfi-rewards";
import {
  SupportedCrypto,
  GrantCardGrantFieldsFragment,
  GrantCardTokenFieldsFragment,
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
  const { reason, amount } = grant;
  return (
    <div className="rounded-xl bg-sand-100 py-4 px-6">
      <div className="flex items-center">
        <div>
          <div className="mb-1.5 text-xl font-medium">
            {getReasonLabel(reason)}
          </div>
          <div>
            {formatCrypto({
              token: SupportedCrypto.Gfi,
              amount: BigNumber.from(amount),
            })}{" "}
            GFI - {format(TOKEN_LAUNCH_TIME * 1000, "MMM d, y")}
          </div>
        </div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
}
