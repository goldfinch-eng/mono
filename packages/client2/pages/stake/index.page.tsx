import { gql } from "@apollo/client";
import { Tab } from "@headlessui/react";
import { BigNumber } from "ethers";

import { Heading, Paragraph, Button } from "@/components/design-system";
import {
  StakedPositionType,
  SupportedCrypto,
  useStakePageQuery,
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import LpOnCurve from "./lp-on-curve";
import StakeCardCollapse from "./stake-card-collapse";
import StakeCardForm, { STAKE_FORM_POSITION_FIELDS } from "./stake-card-form";
import {
  StakeTabGroup,
  StakeTabButton,
  StakeTabContent,
} from "./stake-card-tabs";
import StakeMigrateForm, {
  MIGRATE_FORM_POSITION_FIELDS,
} from "./stake-migrate-form";

gql`
  ${STAKE_FORM_POSITION_FIELDS}
  ${MIGRATE_FORM_POSITION_FIELDS}
  query StakePage($userId: ID!) {
    user(id: $userId) {
      stakedFiduPositions: seniorPoolStakedPositions(
        where: { positionType: Fidu, amount_not: "0" }
      ) {
        id
        amount
        positionType
        endTime @client
        ...StakeFormPositionFields
        ...MigrateFormPositionFields
      }
      stakedCurvePositions: seniorPoolStakedPositions(
        where: { positionType: CurveLP, amount_not: "0" }
      ) {
        id
        amount
        positionType
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

export default function StakePage() {
  const { account } = useWallet();

  const { data, error, loading, refetch } = useStakePageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
    skip: !account,
  });

  const fiduPositions = data?.user?.stakedFiduPositions ?? [];
  const curvePositions = data?.user?.stakedCurvePositions ?? [];
  const fiduStaked = {
    amount: (fiduPositions ?? []).reduce(
      (total, pos) => total.add(pos.amount),
      BigNumber.from(0)
    ),
    token: SupportedCrypto.Fidu,
  };
  const curveStaked = {
    amount: (data?.user?.stakedCurvePositions ?? []).reduce(
      (total, pos) => total.add(pos.amount),
      BigNumber.from(0)
    ),
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
            <div className="mb-3 grid grid-cols-12 items-center px-6 text-sand-500">
              <div className="col-span-5">Token to stake</div>
              <div className="col-span-2 text-right">Est. APY</div>
              <div className="col-span-2 text-right">Available to stake</div>
              <div className="col-span-2 text-right">Staked</div>
            </div>

            <div className="mb-3">
              <StakeCardCollapse
                heading="FIDU"
                subheading="Goldfinch Token"
                staked={fiduStaked}
                available={fiduBalance}
                apy={computeApyFromGfiInFiat(
                  data.seniorPools[0].latestPoolStatus.estimatedApyFromGfiRaw,
                  data.gfiPrice.price.amount
                )}
              >
                <StakeTabGroup>
                  <Tab.List>
                    <StakeTabButton>Stake</StakeTabButton>
                    <StakeTabButton>Unstake</StakeTabButton>
                    <StakeTabButton>Migrate</StakeTabButton>
                  </Tab.List>
                  <Tab.Panels>
                    <StakeTabContent>
                      <StakeCardForm
                        action="STAKE"
                        balance={fiduBalance}
                        positions={fiduPositions}
                        positionType={StakedPositionType.Fidu}
                        onComplete={refetch}
                      />
                    </StakeTabContent>
                    <StakeTabContent>
                      <StakeCardForm
                        action="UNSTAKE"
                        balance={fiduStaked}
                        positions={fiduPositions}
                        positionType={StakedPositionType.Fidu}
                        onComplete={refetch}
                      />
                    </StakeTabContent>
                    <StakeTabContent>
                      <Paragraph className="mb-6">
                        Migrate your staked FIDU to deposit it in the Curve
                        FIDU-USDC liquidity pool, without needing to unstake it
                        on Goldfinch.
                      </Paragraph>
                      <StakeMigrateForm
                        fiduStaked={fiduStaked}
                        usdcBalance={usdcBalance}
                        positions={fiduPositions}
                        sharePrice={
                          data.seniorPools[0].latestPoolStatus.sharePrice
                        }
                        onComplete={refetch}
                      />
                    </StakeTabContent>
                  </Tab.Panels>
                </StakeTabGroup>
              </StakeCardCollapse>
            </div>

            <div>
              <StakeCardCollapse
                heading="FIDU-USDC-F"
                subheading="Curve LP token"
                staked={curveStaked}
                available={curveBalance}
                apy={computeApyFromGfiInFiat(
                  data.curvePool.estimatedCurveStakingApyRaw,
                  data.gfiPrice.price.amount
                )}
              >
                <StakeTabGroup>
                  <Tab.List>
                    <StakeTabButton>Stake</StakeTabButton>
                    <StakeTabButton>Unstake</StakeTabButton>
                  </Tab.List>
                  <Tab.Panels>
                    <StakeTabContent>
                      <StakeCardForm
                        action="STAKE"
                        balance={curveBalance}
                        positions={curvePositions}
                        positionType={StakedPositionType.CurveLp}
                        tokenMask="FIDU-USDC-F"
                        onComplete={refetch}
                      />
                    </StakeTabContent>
                    <StakeTabContent>
                      <StakeCardForm
                        action="UNSTAKE"
                        balance={curveStaked}
                        positions={curvePositions}
                        positionType={StakedPositionType.CurveLp}
                        tokenMask="FIDU-USDC-F"
                        onComplete={refetch}
                      />
                    </StakeTabContent>
                  </Tab.Panels>
                </StakeTabGroup>
              </StakeCardCollapse>
            </div>
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
            fiduBalance={fiduBalance}
            usdcBalance={usdcBalance}
            onComplete={refetch}
          />
        </div>
      )}
    </div>
  );
}
