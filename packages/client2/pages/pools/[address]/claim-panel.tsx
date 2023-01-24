import { gql, useApolloClient } from "@apollo/client";
import clsx from "clsx";
import { BigNumber } from "ethers/lib/ethers";
import { ReactNode } from "react";
import { useForm } from "react-hook-form";

import { Button, Form, InfoIconTooltip } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  ClaimPanelPoolTokenFieldsFragment,
  ClaimPanelVaultedPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

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

export const CLAIM_PANEL_VAULTED_POOL_TOKEN_FIELDS = gql`
  ${CLAIM_PANEL_POOL_TOKEN_FIELDS}
  fragment ClaimPanelVaultedPoolTokenFields on VaultedPoolToken {
    id
    poolToken {
      ...ClaimPanelPoolTokenFields
    }
  }
`;

interface ClaimPanelProps {
  poolTokens: ClaimPanelPoolTokenFieldsFragment[];
  vaultedPoolTokens: ClaimPanelVaultedPoolTokenFieldsFragment[];
  fiatPerGfi: number;
  tranchedPoolAddress: string;
}

/**
 * This component is meant to be for claiming interest and GFI after a pool is locked.
 * If you're looking for the component that allows you to withdraw before a pool is locked, go to withdrawal-panel.tsx
 */
export function ClaimPanel({
  poolTokens,
  vaultedPoolTokens,
  fiatPerGfi,
  tranchedPoolAddress,
}: ClaimPanelProps) {
  const combinedTokens = poolTokens.concat(
    vaultedPoolTokens.map((vpt) => vpt.poolToken)
  );

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

  const rhfMethods = useForm();
  const { provider } = useWallet();
  const apolloClient = useApolloClient();

  const claim = async () => {
    if (!provider) {
      throw new Error("Wallet not properly connected");
    }

    if (poolTokens.length > 0) {
      const tranchedPool = await getContract({
        name: "TranchedPool",
        address: tranchedPoolAddress,
        provider,
      });
      const usdcTransaction = tranchedPool.withdrawMultiple(
        poolTokens.map((pt) => pt.id),
        poolTokens.map((pt) =>
          pt.principalRedeemable.add(pt.interestRedeemable)
        )
      );
      await toastTransaction({
        transaction: usdcTransaction,
        pendingPrompt: "Claiming USDC from your pool token",
      });

      const backerRewardsContract = await getContract({
        name: "BackerRewards",
        provider,
      });
      const gfiTransaction = backerRewardsContract.withdrawMultiple(
        poolTokens.map((pt) => pt.id)
      );
      await toastTransaction({
        transaction: gfiTransaction,
        pendingPrompt: "Claiming GFI rewards from your pool tokens",
      });
    }

    if (vaultedPoolTokens.length > 0) {
      const membershipOrchestrator = await getContract({
        name: "MembershipOrchestrator",
        provider,
      });
      const transaction = membershipOrchestrator.harvest(
        vaultedPoolTokens.map((vpt) => vpt.id)
      );
      await toastTransaction({
        transaction,
        pendingPrompt:
          "Claiming USDC and GFI rewards from your vaulted pool tokens",
      });
    }

    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <div className="rounded-xl bg-midnight-01 p-5 text-white">
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div>Your current position value</div>
          <InfoIconTooltip
            className="text-white opacity-60"
            content="The remaining principal on this position plus any accrued interest."
          />
        </div>
        <div className="text-5xl font-medium">
          {formatCrypto(positionValue)}
        </div>
      </div>
      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>Available to claim</div>
          <InfoIconTooltip
            className="text-white opacity-60"
            content="The combined dollar value of claimable principal, interest, and GFI rewards on this position."
          />
        </div>
        <div className="text-3xl">
          {formatCrypto({
            token: "USDC",
            amount: claimableUsdc.amount.add(claimableGfiAsUsdc.amount),
          })}
        </div>
      </div>
      <MiniTable className="mb-4">
        <tbody>
          <tr className="first-row group">
            <MiniTableCell fadingBg>
              <div className="flex items-center justify-between gap-2">
                USDC
                <InfoIconTooltip
                  size="xs"
                  className="text-white opacity-60"
                  content="This includes your claimable principal and interest."
                />
              </div>
            </MiniTableCell>
            <MiniTableCell alignRight fadingText>
              {formatCrypto(claimableUsdc, {
                includeSymbol: false,
                includeToken: true,
              })}
            </MiniTableCell>
            <MiniTableCell alignRight>
              {formatCrypto(claimableUsdc, {
                includeSymbol: true,
                includeToken: false,
              })}
            </MiniTableCell>
          </tr>
          <tr className="last-row group">
            <MiniTableCell fadingBg>
              <div className="flex items-center justify-between gap-2">
                GFI
                <InfoIconTooltip
                  size="xs"
                  className="text-white opacity-60"
                  content="Your GFI rewards for backing this pool."
                />
              </div>
            </MiniTableCell>
            <MiniTableCell alignRight fadingText>
              {formatCrypto(claimableGfi, {
                includeSymbol: false,
                includeToken: true,
              })}
            </MiniTableCell>
            <MiniTableCell alignRight>
              {formatCrypto(claimableGfiAsUsdc, {
                includeSymbol: true,
                includeToken: false,
              })}
            </MiniTableCell>
          </tr>
        </tbody>
      </MiniTable>
      <Form rhfMethods={rhfMethods} onSubmit={claim}>
        <Button
          type="submit"
          className="w-full"
          size="xl"
          colorScheme="secondary"
        >
          Claim
        </Button>
      </Form>
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
  fadingBg = false,
  fadingText = false,
  alignRight = false,
}: {
  className?: string;
  children: ReactNode;
  fadingBg?: boolean;
  fadingText?: boolean;
  alignRight?: boolean;
}) {
  return (
    <td
      className={clsx(
        "border border-white border-opacity-25 py-2 px-3 first:border-l-0 last:border-r-0 group-[.first-row]:border-t-0 group-[.last-row]:border-b-0",
        fadingBg ? "bg-white bg-opacity-5" : null,
        fadingText ? "text-white text-opacity-60" : null,
        alignRight ? "text-right" : null
      )}
    >
      {children}
    </td>
  );
}
