import { gql, useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import {
  Alert,
  Button,
  Form,
  InfoIconTooltip,
  Link,
  MiniTable,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  ClaimPanelPoolTokenFieldsFragment,
  ClaimPanelLoanFieldsFragment,
  ClaimPanelVaultedPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

import { CallPanel } from "./call/submit-call-panel";

export const CLAIM_PANEL_POOL_TOKEN_FIELDS = gql`
  fragment ClaimPanelPoolTokenFields on PoolToken {
    id
    principalAmount
    principalRedeemable
    principalRedeemed
    interestRedeemable
    rewardsClaimable
    rewardsClaimed
    stakingRewardsClaimable
    stakingRewardsClaimed
    ...CallPanelPoolTokenFields
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

export const CLAIM_PANEL_LOAN_FIELDS = gql`
  fragment ClaimPanelLoanFields on Loan {
    __typename
    id
    isLate @client
    ... on CallableLoan {
      ...CallPanelCallableLoanFields
    }
  }
`;

interface ClaimPanelProps {
  poolTokens: ClaimPanelPoolTokenFieldsFragment[];
  vaultedPoolTokens: ClaimPanelVaultedPoolTokenFieldsFragment[];
  fiatPerGfi: number;
  loan: ClaimPanelLoanFieldsFragment;
}

/**
 * This component is meant to be for claiming interest and GFI after a pool is locked.
 * If you're looking for the component that allows you to withdraw before a pool is locked, go to withdrawal-panel.tsx
 */
export function ClaimPanel({
  poolTokens,
  vaultedPoolTokens,
  fiatPerGfi,
  loan,
}: ClaimPanelProps) {
  const canClaimGfi = !loan.isLate;

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
      const loanContract = await getContract({
        name:
          loan.__typename === "TranchedPool" ? "TranchedPool" : "CallableLoan",
        address: loan.id,
        provider,
      });
      const usdcTransaction = loanContract.withdrawMultiple(
        poolTokens.map((pt) => pt.id),
        poolTokens.map((pt) =>
          pt.principalRedeemable.add(pt.interestRedeemable)
        )
      );
      await toastTransaction({
        transaction: usdcTransaction,
        pendingPrompt: "Claiming USDC from your pool token",
      });

      if (canClaimGfi) {
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
    }

    if (vaultedPoolTokens.length > 0 && canClaimGfi) {
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

  const claimDisabled =
    (claimableUsdc.amount.isZero() && claimableGfi.amount.isZero()) ||
    (claimableUsdc.amount.isZero() && !canClaimGfi) ||
    (vaultedPoolTokens.length > 0 && !canClaimGfi);

  return (
    <div>
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div>Your current position value</div>
          <InfoIconTooltip content="The remaining principal on this position plus any accrued interest." />
        </div>
        <div className="font-serif text-5xl font-semibold">
          {formatCrypto(positionValue)}
        </div>
      </div>
      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>Available to claim</div>
          <InfoIconTooltip content="The combined dollar value of claimable principal, interest, and GFI rewards on this position." />
        </div>
        <div className="font-serif text-3xl">
          {formatCrypto({
            token: "USDC",
            amount: claimableUsdc.amount.add(claimableGfiAsUsdc.amount),
          })}
        </div>
      </div>
      {/* eslint-disable react/jsx-key */}
      <MiniTable
        className="mb-4"
        colorScheme="mustard"
        rows={[
          [
            <div className="flex items-center justify-between gap-2">
              USDC
              <InfoIconTooltip
                size="xs"
                content="This includes your claimable principal and interest."
              />
            </div>,
            formatCrypto(claimableUsdc, {
              includeSymbol: false,
              includeToken: true,
            }),
            formatCrypto(claimableUsdc, {
              includeSymbol: true,
              includeToken: false,
            }),
          ],
          [
            <div className="flex items-center justify-between gap-2">
              GFI
              <InfoIconTooltip
                size="xs"
                content="Your GFI rewards for backing this pool."
              />
            </div>,
            formatCrypto(claimableGfi, {
              includeSymbol: false,
              includeToken: true,
            }),
            formatCrypto(claimableGfiAsUsdc, {
              includeSymbol: true,
              includeToken: false,
            }),
          ],
        ]}
      />
      <Form rhfMethods={rhfMethods} onSubmit={claim}>
        <Button
          type="submit"
          className="w-full"
          size="xl"
          colorScheme="mustard"
          disabled={claimDisabled}
        >
          Claim
        </Button>
      </Form>
      {vaultedPoolTokens.length > 0 && !canClaimGfi ? (
        <Alert type="warning" className="mt-4">
          <div>
            <div>
              Claiming is disabled because your pool token is vaulted and this
              pool is late on repayment. If you wish to claim the USDC from this
              late pool, you must first unvault your token.
            </div>
            <Link href="/membership" iconRight="ArrowSmRight">
              Go to vault
            </Link>
          </div>
        </Alert>
      ) : !canClaimGfi ? (
        <Alert type="warning" className="mt-4">
          You cannot claim GFI rewards from this pool because it is late on
          repayment.
        </Alert>
      ) : null}
      {loan.__typename === "CallableLoan" ? (
        <CallPanel
          className="mt-8"
          callableLoan={loan}
          poolTokens={poolTokens}
        />
      ) : null}
    </div>
  );
}
