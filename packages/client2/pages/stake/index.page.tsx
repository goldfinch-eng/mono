import { gql } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import {
  Heading,
  Paragraph,
  Button,
  InfoIconTooltip,
  Shimmer,
} from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  StakedPositionType,
  SupportedCrypto,
  useStakePageQuery,
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat, sum } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { ExpandableCard } from "./expandable-card";
import curveIcon from "./icons/curve.png";
import fiduCurve from "./icons/fidu-curve.png";
import gfIcon from "./icons/fidu.png";
import usdcCurve from "./icons/usdc-curve.png";
import { LpCurveForm } from "./lp-curve-form";
import { MigrateForm, MIGRATE_FORM_POSITION_FIELDS } from "./migrate-form";
import { Tab } from "./stake-card-tabs";
import { StakeForm } from "./stake-form";
import { UnstakeForm, UNSTAKE_FORM_POSITION_FIELDS } from "./unstake-form";

gql`
  ${UNSTAKE_FORM_POSITION_FIELDS}
  ${MIGRATE_FORM_POSITION_FIELDS}
  query StakePage($userId: ID!) {
    user(id: $userId) {
      stakedFiduPositions: seniorPoolStakedPositions(
        where: { positionType: Fidu, amount_not: "0" }
      ) {
        id
        amount
        ...UnstakeFormPositionFields
        ...MigrateFormPositionFields
      }
      stakedCurvePositions: seniorPoolStakedPositions(
        where: { positionType: CurveLP, amount_not: "0" }
      ) {
        id
        amount
        ...UnstakeFormPositionFields
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

export default function StakePage() {
  const { account } = useWallet();

  const { data, error, loading, refetch } = useStakePageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
  });

  const fiduPositions = data?.user?.stakedFiduPositions ?? [];
  const curvePositions = data?.user?.stakedCurvePositions ?? [];
  const fiduStaked = {
    amount: sum("amount", fiduPositions),
    token: SupportedCrypto.Fidu,
  };
  const curveStaked = {
    amount: sum("amount", data?.user?.stakedCurvePositions),
    token: SupportedCrypto.CurveLp,
  };
  const fiduBalance = data?.viewer.fiduBalance ?? {
    amount: BigNumber.from(0),
    token: SupportedCrypto.Fidu,
  };
  const curveBalance = data?.viewer.curveLpBalance ?? {
    amount: BigNumber.from(0),
    token: SupportedCrypto.CurveLp,
  };
  const usdcBalance = data?.viewer.usdcBalance ?? {
    amount: BigNumber.from(0),
    token: SupportedCrypto.Usdc,
  };

  const curveApyFromGfi = data
    ? computeApyFromGfiInFiat(
        data.curvePool.estimatedCurveStakingApyRaw,
        data.gfiPrice.price.amount
      )
    : FixedNumber.from(0);

  const curveApyFromGfiWithTooltip = (
    <div className="flex items-center">
      <div className="whitespace-nowrap">
        {formatPercent(curveApyFromGfi)} GFI
      </div>
      <InfoIconTooltip
        className="relative z-10"
        content="GFI reward APY for the FIDU portion of a Curve LP position. The USDC portion does not receive GFI rewards. The entire Curve LP position accrues swap fees."
      />
    </div>
  );

  return (
    <div>
      <Heading level={1} className="mb-12 text-7xl">
        Stake
      </Heading>

      {!account && !loading ? (
        <div className="mb-12 text-lg font-medium text-clay-500">
          You must connect your wallet to view your available tokens.
        </div>
      ) : null}

      {error ? (
        <div className="text-clay-500">{error.message}</div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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

          {loading || !data ? (
            <>
              <Shimmer className="mb-3 h-24" />
              <Shimmer className="mb-15 h-24" />
            </>
          ) : (
            <>
              <ExpandableCard
                className="mb-3"
                icon={gfIcon}
                heading="FIDU"
                subheading="Goldfinch Token"
                headingLabel="Token to stake"
                slot1={`${formatPercent(
                  computeApyFromGfiInFiat(
                    data.seniorPools[0].latestPoolStatus.estimatedApyFromGfiRaw,
                    data.gfiPrice.price.amount
                  )
                )} GFI`}
                slot1Label="Est. APY"
                slot2={formatCrypto(fiduBalance)}
                slot2Label="Available"
                slot3={formatCrypto(fiduStaked)}
                slot3Label="Staked"
              >
                <Tab.Group>
                  <Tab.List>
                    <Tab>Stake</Tab>
                    <Tab>Unstake</Tab>
                    <Tab>Migrate</Tab>
                  </Tab.List>
                  <Tab.Panels>
                    <Tab.Panel>
                      <StakeForm
                        max={fiduBalance}
                        positionType={StakedPositionType.Fidu}
                        onComplete={refetch}
                      />
                    </Tab.Panel>
                    <Tab.Panel>
                      <UnstakeForm
                        max={fiduStaked}
                        positions={fiduPositions}
                        positionType={StakedPositionType.Fidu}
                        onComplete={refetch}
                      />
                    </Tab.Panel>
                    <Tab.Panel>
                      <Paragraph className="mb-6">
                        Migrate your staked FIDU to deposit it in the Curve
                        FIDU-USDC liquidity pool, without needing to unstake it
                        on Goldfinch.
                      </Paragraph>
                      <MigrateForm
                        fiduStaked={fiduStaked}
                        usdcBalance={usdcBalance}
                        positions={fiduPositions}
                        sharePrice={
                          data.seniorPools[0].latestPoolStatus.sharePrice
                        }
                        onComplete={refetch}
                      />
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </ExpandableCard>

              <ExpandableCard
                className="mb-15"
                icon={curveIcon}
                heading="FIDU-USDC-F"
                subheading="Curve LP Token"
                headingLabel="Token to stake"
                slot1={curveApyFromGfiWithTooltip}
                slot1Label="Est. APY"
                slot2={formatCrypto(curveBalance)}
                slot2Label="Available"
                slot3={formatCrypto(curveStaked)}
                slot3Label="Staked"
                hideTopLabels
              >
                <Tab.Group>
                  <Tab.List>
                    <Tab>Stake</Tab>
                    <Tab>Unstake</Tab>
                  </Tab.List>
                  <Tab.Panels>
                    <Tab.Panel>
                      <StakeForm
                        max={curveBalance}
                        positionType={StakedPositionType.CurveLp}
                        onComplete={refetch}
                      />
                    </Tab.Panel>
                    <Tab.Panel>
                      <UnstakeForm
                        max={curveStaked}
                        positions={curvePositions}
                        positionType={StakedPositionType.CurveLp}
                        onComplete={refetch}
                      />
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </ExpandableCard>
            </>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Heading level={5} className="!font-normal">
              LP on Curve
            </Heading>
            <div className="flex flex-wrap gap-3">
              <Button
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
          </div>

          <Paragraph className="mb-8 !text-lg">
            Deposit your unstaked FIDU or USDC into the FIDU-USDC Curve
            liquidity pool, with the option to stake your resulting Curve LP
            tokens on Goldfinch.
          </Paragraph>

          {loading || !data ? (
            <>
              <Shimmer className="mb-3 h-24" />
              <Shimmer className="h-24" />
            </>
          ) : (
            <>
              <ExpandableCard
                className="mb-3"
                icon={fiduCurve}
                heading="Deposit FIDU"
                subheading="via Curve FIDU-USDC pool"
                headingLabel="Token to deposit"
                slot1={curveApyFromGfiWithTooltip}
                slot1Label="Est. APY"
                slot2={formatCrypto(fiduBalance)}
                slot2Label="Available"
              >
                <LpCurveForm
                  balance={fiduBalance}
                  type="FIDU"
                  onComplete={refetch}
                />
              </ExpandableCard>
              <ExpandableCard
                icon={usdcCurve}
                heading="Deposit USDC"
                subheading="via Curve FIDU-USDC pool"
                headingLabel="Token to deposit"
                slot1={curveApyFromGfiWithTooltip}
                slot1Label="Est. APY"
                slot2={formatCrypto(usdcBalance)}
                slot2Label="Available"
                hideTopLabels
              >
                <LpCurveForm
                  balance={usdcBalance}
                  type="USDC"
                  onComplete={refetch}
                />
              </ExpandableCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}
