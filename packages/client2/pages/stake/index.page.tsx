import { gql } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { Heading, Paragraph, Button } from "@/components/design-system";
import {
  SupportedCrypto,
  useStakePageQuery,
  SeniorPoolStakedPosition,
} from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import LpOnCurve from "./lp-on-curve";
import { MIGRATE_FORM_POSITION_FIELDS } from "./stake-migrate-form";
import StakeOnGoldfinch from "./stake-on-goldfinch";

gql`
  ${MIGRATE_FORM_POSITION_FIELDS}
  query StakePage($userId: ID!) {
    user(id: $userId) {
      stakedFiduPositions: seniorPoolStakedPositions(
        where: { positionType: Fidu, amount_not: "0" }
      ) {
        id
        initialAmount
        amount
        positionType
        startTime
        totalRewardsClaimed
        endTime @client
        ...MigrateFormPositionFields
      }
      stakedCurvePositions: seniorPoolStakedPositions(
        where: { positionType: CurveLP, amount_not: "0" }
      ) {
        id
        initialAmount
        amount
        positionType
        startTime
        totalRewardsClaimed
        endTime @client
        ...MigrateFormPositionFields
      }
    }
    seniorPools(first: 1) {
      id
      latestPoolStatus {
        id
        estimatedApy
        estimatedApyFromGfiRaw
        sharePrice
      }
    }
    gfiPrice(fiat: USD) @client {
      lastUpdated
      price {
        amount
        symbol
      }
    }
    viewer @client {
      usdcBalance {
        token
        amount
      }
      fiduBalance {
        token
        amount
      }
      curveLpBalance {
        token
        amount
      }
    }
    curvePool @client {
      estimatedCurveStakingApyRaw
    }
  }
`;

export type SimpleStakedPosition = Omit<
  SeniorPoolStakedPosition,
  "claimable" | "granted" | "rewardEarnRate" | "user"
>;

export default function StakePage() {
  const { account } = useWallet();

  const { data, error, loading, refetch } = useStakePageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
    skip: !account,
  });

  const seniorPool = data?.seniorPools?.[0]?.latestPoolStatus?.sharePrice
    ? data.seniorPools[0]
    : undefined;

  const fiduStaked = (data?.user?.stakedFiduPositions ?? []).reduce(
    (total, pos) => total.add(pos.amount),
    BigNumber.from(0)
  );

  const curveStaked = (data?.user?.stakedCurvePositions ?? []).reduce(
    (total, pos) => total.add(pos.amount),
    BigNumber.from(0)
  );

  return (
    <div>
      <Heading level={1} className="mb-12 text-7xl">
        Stake
      </Heading>

      {!account ? (
        <div>You must connect your wallet to stake your tokens</div>
      ) : loading || !data ? (
        <div>Loading</div>
      ) : error ? (
        <div className="text-clay-500">{error.message}</div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Heading level={5} className="!font-normal">
              Stake on Goldfinch
            </Heading>
            <Button
              className="block"
              as="a"
              size="lg"
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/staking"
              iconRight="ArrowTopRight"
              variant="rounded"
              target="_blank"
              colorScheme="secondary"
            >
              Learn more
            </Button>
          </div>
          <Paragraph className="mb-8 !text-lg">
            Stake your FIDU, or your LP tokens from providing liquidity to the
            Curve FIDU-USDC pool, on Goldfinch to earn additional GFI rewards.
            Or, migrate your staked FIDU to the Curve FIDU-USDC pool.
          </Paragraph>

          <div className="mb-15">
            <StakeOnGoldfinch
              fiduStaked={{ amount: fiduStaked, token: SupportedCrypto.Fidu }}
              fiduBalance={
                data?.viewer.fiduBalance ?? {
                  amount: BigNumber.from(0),
                  token: SupportedCrypto.Fidu,
                }
              }
              curveStaked={{
                amount: curveStaked,
                token: SupportedCrypto.CurveLp,
              }}
              curveBalance={
                data?.viewer.curveLpBalance ?? {
                  amount: BigNumber.from(0),
                  token: SupportedCrypto.CurveLp,
                }
              }
              usdcBalance={
                data?.viewer.usdcBalance ?? {
                  amount: BigNumber.from(0),
                  token: SupportedCrypto.Usdc,
                }
              }
              sharePrice={
                seniorPool
                  ? seniorPool.latestPoolStatus.sharePrice
                  : BigNumber.from(0)
              }
              fiduPositions={data?.user?.stakedFiduPositions ?? []}
              curvePositions={data?.user?.stakedCurvePositions ?? []}
              gfiApi={
                seniorPool?.latestPoolStatus?.estimatedApyFromGfiRaw ??
                FixedNumber.from(0)
              }
              gfiPrice={data?.gfiPrice?.price?.amount ?? 0}
              onComplete={refetch}
            />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <Heading level={5} className="!font-normal">
              LP on Curve
            </Heading>
            <Button
              className="ml-auto block"
              as="a"
              size="lg"
              href="https://curve.fi/factory-crypto/23"
              iconRight="ArrowTopRight"
              variant="rounded"
              target="_blank"
              colorScheme="secondary"
            >
              View pool on Curve
            </Button>
            <Button
              className="ml-3 block"
              as="a"
              size="lg"
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/staking"
              iconRight="ArrowTopRight"
              variant="rounded"
              target="_blank"
              colorScheme="secondary"
            >
              Learn more
            </Button>
          </div>

          <Paragraph className="mb-8 !text-lg">
            Deposit your unstaked FIDU or USDC into the FIDU-USDC Curve
            liquidity pool, with the option to stake your resulting Curve LP
            tokens on Goldfinch.
          </Paragraph>
          <LpOnCurve
            fiduBalance={
              data?.viewer.fiduBalance ?? {
                amount: BigNumber.from(0),
                token: SupportedCrypto.Fidu,
              }
            }
            usdcBalance={
              data?.viewer.usdcBalance ?? {
                amount: BigNumber.from(0),
                token: SupportedCrypto.Usdc,
              }
            }
            onComplete={refetch}
          />
        </div>
      )}
    </div>
  );
}
