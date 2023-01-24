import { gql } from "@apollo/client";
import clsx from "clsx";
import { BigNumber } from "ethers/lib/ethers";
import { ReactNode } from "react";

import { Button, InfoIconTooltip } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { ClaimPanelPoolTokenFieldsFragment } from "@/lib/graphql/generated";
import { gfiToUsdc, sum } from "@/lib/pools";

export const CLAIM_PANEL_POOL_TOKEN_FIELDS = gql`
  fragment ClaimPanelPoolTokenFields on TranchedPoolToken {
    id
    principalAmount
    principalRedeemable
    principalRedeemed
    interestRedeemable
    rewardsClaimable
    rewardsClaimed
    stakingRewardsClaimable
    stakingRewardsClaimed
  }
`;

interface ClaimPanelProps {
  poolTokens: ClaimPanelPoolTokenFieldsFragment[];
  vaultedPoolTokens: ClaimPanelPoolTokenFieldsFragment[];
  fiatPerGfi: number;
}

/**
 * This component is meant to be for claiming interest and GFI after a pool is locked.
 * If you're looking for the component that allows you to withdraw before a pool is locked, go to withdrawal-panel.tsx
 */
export function ClaimPanel({
  poolTokens,
  vaultedPoolTokens,
  fiatPerGfi,
}: ClaimPanelProps) {
  const combinedTokens = poolTokens.concat(vaultedPoolTokens);

  const positionValue = {
    token: "USDC",
    amount: combinedTokens.reduce(
      (prev, current) =>
        prev
          .add(current.principalAmount)
          .sub(current.principalRedeemed)
          .add(current.interestRedeemable),
      BigNumber.from(0)
    ),
  } as const;

  const claimableUsdc = {
    token: "USDC",
    amount: sum("principalRedeemable", combinedTokens).add(
      sum("interestRedeemable", combinedTokens)
    ),
  } as const;

  const claimableGfi = {
    token: "GFI",
    amount: sum("rewardsClaimable", combinedTokens).add(
      sum("stakingRewardsClaimable", combinedTokens)
    ),
  } as const;
  const claimableGfiAsUsdc = gfiToUsdc(claimableGfi, fiatPerGfi);

  return (
    <div className="rounded-xl bg-midnight-01 p-5 text-white">
      <div className="mb-6">
        <div className="mb-1">Your current position value</div>
        <div className="text-5xl font-medium">
          {formatCrypto(positionValue)}
        </div>
      </div>
      <div className="mb-2">
        <div className="mb-1">Available to claim</div>
        <div className="text-3xl font-medium">
          {formatCrypto({
            token: "USDC",
            amount: claimableUsdc.amount.add(claimableGfiAsUsdc.amount),
          })}
        </div>
      </div>
      <MiniTable className="mb-4">
        <tbody>
          <tr>
            <MiniTableCell noTopBorder fadingBg>
              <div className="flex items-center justify-between gap-2">
                USDC
                <InfoIconTooltip
                  className="text-white opacity-60"
                  content="This includes your claimable principal and interest."
                />
              </div>
            </MiniTableCell>
            <MiniTableCell noTopBorder alignRight fadingText>
              {formatCrypto(claimableUsdc, {
                includeSymbol: false,
                includeToken: true,
              })}
            </MiniTableCell>
            <MiniTableCell noTopBorder alignRight>
              {formatCrypto(claimableUsdc, {
                includeSymbol: true,
                includeToken: false,
              })}
            </MiniTableCell>
          </tr>
          <tr>
            <MiniTableCell noBottomBorder fadingBg>
              <div className="flex items-center justify-between gap-2">
                GFI
                <InfoIconTooltip
                  className="text-white opacity-60"
                  content="Your GFI rewards for backing this pool."
                />
              </div>
            </MiniTableCell>
            <MiniTableCell noBottomBorder alignRight fadingText>
              {formatCrypto(claimableGfi, {
                includeSymbol: false,
                includeToken: true,
              })}
            </MiniTableCell>
            <MiniTableCell noBottomBorder alignRight>
              {formatCrypto(claimableGfiAsUsdc, {
                includeSymbol: true,
                includeToken: false,
              })}
            </MiniTableCell>
          </tr>
        </tbody>
      </MiniTable>
      <Button className="w-full" size="xl" colorScheme="secondary">
        Claim
      </Button>
    </div>
  );
}

function MiniTable({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <div
      className={clsx(
        className,
        "rounded border border-white border-opacity-25 text-xs"
      )}
    >
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

function MiniTableCell({
  children,
  noTopBorder = false,
  noBottomBorder = false,
  fadingBg = false,
  fadingText = false,
  alignRight = false,
}: {
  className?: string;
  children: ReactNode;
  noTopBorder?: boolean;
  noBottomBorder?: boolean;
  fadingBg?: boolean;
  fadingText?: boolean;
  alignRight?: boolean;
}) {
  return (
    <td
      className={clsx(
        "border border-white border-opacity-25 py-2 px-3 first:border-l-0 last:border-r-0",
        noTopBorder ? "border-t-0" : null,
        noBottomBorder ? "border-b-0" : null,
        fadingBg ? "bg-white bg-opacity-5" : null,
        fadingText ? "text-white text-opacity-60" : null,
        alignRight ? "text-right" : null
      )}
    >
      {children}
    </td>
  );
}
