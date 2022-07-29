import { gql } from "@apollo/client";
import { format } from "date-fns";

import { Button } from "@/components/design-system";
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
  const { reason, amount, claimable } = grant;
  const locked = amount.sub(claimable);
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
            {getReasonLabel(reason)}
          </div>
          <div className="text-sand-700">
            {formatCrypto(
              {
                token: SupportedCrypto.Gfi,
                amount,
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
          {formatCrypto({ token: SupportedCrypto.Gfi, amount: claimable })}
        </div>
        <div className="justify-self-end">
          <Button size="lg">Lorem</Button>
        </div>
      </div>
    </div>
  );
}
