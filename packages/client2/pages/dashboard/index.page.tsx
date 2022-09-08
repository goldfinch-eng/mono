import { gql } from "@apollo/client";
import { BigNumber, FixedNumber, utils } from "ethers";
import { useMemo } from "react";

import {
  Heading,
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { GFI_DECIMALS, USDC_DECIMALS } from "@/constants";
import { formatCrypto } from "@/lib/format";
import {
  stitchGrantsWithTokens,
  sumTotalClaimable,
  sumTotalLocked,
} from "@/lib/gfi-rewards";
import {
  CryptoAmount,
  SupportedCrypto,
  useDashboardPageQuery,
} from "@/lib/graphql/generated";
import { sharesToUsdc, sum } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { ExpandableHoldings } from "./expandable-holdings";
import { PortfolioSummary } from "./portfolio-summary";
import { TransactionTable } from "./transaction-table";

gql`
  fragment StakedPositionFields on SeniorPoolStakedPosition {
    id
    amount
    claimable @client
    granted @client
    totalRewardsClaimed
  }
  query DashboardPage($userId: String!) {
    seniorPools {
      id
      latestPoolStatus {
        id
        sharePrice
      }
    }
    viewer @client {
      fiduBalance {
        token
        amount
      }
      gfiBalance {
        token
        amount
      }
      curveLpBalance {
        token
        amount
      }
      gfiGrants {
        __typename
        id
        index
        amount
        ... on IndirectGfiGrant {
          indirectSource
          vested
        }
        ... on DirectGfiGrant {
          isAccepted
        }
      }
    }
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
      }
    }
    curvePool @client {
      usdcPerLpToken
    }
    tranchedPoolTokens(
      where: { user: $userId, principalAmount_gt: 0 }
      orderBy: mintedAt
      orderDirection: desc
    ) {
      id
      principalAmount
      rewardsClaimable
      stakingRewardsClaimable
      tranchedPool {
        id
        name @client
      }
    }
    stakedFiduPositions: seniorPoolStakedPositions(
      where: { user: $userId, amount_gt: 0, positionType: Fidu }
      orderBy: startTime
      orderDirection: desc
    ) {
      ...StakedPositionFields
    }
    stakedCurveLpPositions: seniorPoolStakedPositions(
      where: { user: $userId, amount_gt: 0, positionType: CurveLP }
      orderBy: startTime
      orderDirection: desc
    ) {
      ...StakedPositionFields
    }
    communityRewardsTokens(where: { user: $userId }) {
      id
      source
      index
      totalClaimed
    }
  }
`;

const borrowerPoolColorClass = "bg-eggplant-300";
const gfiColorClass = "bg-mustard-450";
const seniorPoolColorClass = "bg-mint-300";
const curveColorClass = "bg-tidepool-600";

export default function DashboardPage() {
  const { account } = useWallet();
  const { data, loading, error } = useDashboardPageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
  });

  const gfiRewardsTotal = useMemo(() => {
    if (!data) {
      return BigNumber.from(0);
    }
    const grantsWithTokens = stitchGrantsWithTokens(
      data.viewer.gfiGrants,
      data.communityRewardsTokens
    );
    const gfiTotalClaimable = sumTotalClaimable(
      grantsWithTokens,
      data.tranchedPoolTokens,
      data.stakedFiduPositions.concat(data.stakedCurveLpPositions)
    );
    const gfiTotalLocked = sumTotalLocked(
      grantsWithTokens,
      data.stakedFiduPositions.concat(data.stakedCurveLpPositions)
    );
    return gfiTotalClaimable.add(gfiTotalLocked);
  }, [data]);

  const { summaryHoldings, totalUsdc } = useMemo(() => {
    if (!data) {
      return {};
    }
    const borrowerPoolTotal = {
      token: SupportedCrypto.Usdc,
      amount: sum("principalAmount", data.tranchedPoolTokens),
    };

    const gfiTotal = data.viewer.gfiBalance
      ? gfiToUsdc(
          {
            token: SupportedCrypto.Gfi,
            amount: data.viewer.gfiBalance.amount.add(gfiRewardsTotal),
          },
          data.gfiPrice.price.amount
        )
      : {
          token: SupportedCrypto.Usdc,
          amount: gfiRewardsTotal,
        };

    const seniorPoolTotal = sharesToUsdc(
      sum("amount", data.stakedFiduPositions).add(
        data.viewer.fiduBalance?.amount ?? BigNumber.from(0)
      ),
      data.seniorPools[0].latestPoolStatus.sharePrice
    );

    const curveLpTotal = curveLpTokensToUsdc(
      sum("amount", data.stakedCurveLpPositions).add(
        data.viewer.curveLpBalance
          ? data.viewer.curveLpBalance.amount
          : BigNumber.from(0)
      ),
      data.curvePool.usdcPerLpToken
    );

    const totalUsdc = {
      token: SupportedCrypto.Usdc,
      amount: sum("amount", [
        borrowerPoolTotal,
        gfiTotal,
        seniorPoolTotal,
        curveLpTotal,
      ]),
    };

    const summaryHoldings = [
      {
        name: "Borrower Pools",
        usdc: borrowerPoolTotal,
        colorClass: borrowerPoolColorClass,
        percentage: computePercentage(
          borrowerPoolTotal.amount,
          totalUsdc.amount
        ),
      },
      {
        name: "GFI",
        usdc: gfiTotal,
        percentage: computePercentage(gfiTotal.amount, totalUsdc.amount),
        colorClass: gfiColorClass,
      },
      {
        name: "Senior Pool",
        usdc: seniorPoolTotal,
        percentage: computePercentage(seniorPoolTotal.amount, totalUsdc.amount),
        colorClass: seniorPoolColorClass,
      },
      {
        name: "Curve LP",
        usdc: curveLpTotal,
        percentage: computePercentage(curveLpTotal.amount, totalUsdc.amount),
        colorClass: curveColorClass,
      },
    ];

    return {
      totalUsdc,
      summaryHoldings,
    };
  }, [data, gfiRewardsTotal]);

  return (
    <div>
      <Heading level={1} className="mb-12">
        Dashboard
      </Heading>
      {!account && !loading ? (
        <div className="text-lg font-medium text-clay-500">
          You must connect your wallet to view your dashboard
        </div>
      ) : error ? (
        <div className="text-clay-500">Error: {error.message}</div>
      ) : !data || !totalUsdc || !summaryHoldings || loading ? (
        <div>Loading</div>
      ) : (
        <div>
          <TabGroup>
            <TabList>
              <TabButton>Overview</TabButton>
              <TabButton>Activity</TabButton>
            </TabList>
            <TabPanels>
              <TabContent>
                <PortfolioSummary
                  className="mb-15"
                  holdings={summaryHoldings}
                  totalUsdc={totalUsdc}
                />
                <Heading level={3} className="mb-6 !font-sans !text-xl">
                  Holdings
                </Heading>
                <div className="mb-24 space-y-3">
                  {data.tranchedPoolTokens.length > 0 ? (
                    <ExpandableHoldings
                      title="Borrower Pool Positions"
                      tooltip="Your investment in Goldfinch borrower pools. Each investment position is represented by an NFT."
                      colorClass={borrowerPoolColorClass}
                      holdings={data.tranchedPoolTokens.map((token) => ({
                        name: token.tranchedPool.name,
                        percentage: computePercentage(
                          token.principalAmount,
                          totalUsdc.amount
                        ),
                        quantity: BigNumber.from(1),
                        usdcValue: {
                          token: SupportedCrypto.Usdc,
                          amount: token.principalAmount,
                        },
                        url: `/pools/${token.tranchedPool.id}`,
                      }))}
                      quantityFormatter={(n: BigNumber) =>
                        `${n.toString()} NFT${
                          n.gt(BigNumber.from(1)) ? "s" : ""
                        }`
                      }
                    />
                  ) : null}
                  {(data.viewer.gfiBalance &&
                    !data.viewer.gfiBalance.amount.isZero()) ||
                  !gfiRewardsTotal.isZero() ? (
                    <ExpandableHoldings
                      title="GFI"
                      tooltip="Your GFI tokens"
                      colorClass={gfiColorClass}
                      holdings={[
                        ...(data.viewer.gfiBalance &&
                        !data.viewer.gfiBalance.amount.isZero()
                          ? [
                              {
                                name: "Wallet holdings",
                                percentage: computePercentage(
                                  gfiToUsdc(
                                    data.viewer.gfiBalance,
                                    data.gfiPrice.price.amount
                                  ).amount,
                                  totalUsdc.amount
                                ),
                                quantity: data.viewer.gfiBalance.amount,
                                usdcValue: gfiToUsdc(
                                  data.viewer.gfiBalance,
                                  data.gfiPrice.price.amount
                                ),
                              },
                            ]
                          : []),
                        ...(!gfiRewardsTotal.isZero()
                          ? [
                              {
                                name: "GFI Rewards",
                                percentage: computePercentage(
                                  gfiToUsdc(
                                    {
                                      token: SupportedCrypto.Gfi,
                                      amount: gfiRewardsTotal,
                                    },
                                    data.gfiPrice.price.amount
                                  ).amount,
                                  totalUsdc.amount
                                ),
                                quantity: gfiRewardsTotal,
                                usdcValue: gfiToUsdc(
                                  {
                                    token: SupportedCrypto.Gfi,
                                    amount: gfiRewardsTotal,
                                  },
                                  data.gfiPrice.price.amount
                                ),
                                url: "/gfi",
                              },
                            ]
                          : []),
                      ]}
                      quantityFormatter={(n: BigNumber) =>
                        formatCrypto(
                          { token: SupportedCrypto.Gfi, amount: n },
                          { includeToken: true }
                        )
                      }
                    />
                  ) : null}
                  {(data.viewer.fiduBalance &&
                    !data.viewer.fiduBalance.amount.isZero()) ||
                  data.stakedFiduPositions.length > 0 ? (
                    <ExpandableHoldings
                      title="Goldfinch Senior Pool"
                      tooltip="Your investment in the Goldfinch Senior Pool. This is quantified by a token called FIDU."
                      colorClass={seniorPoolColorClass}
                      holdings={[
                        ...data.stakedFiduPositions.map((stakedPosition) => ({
                          name: "Staked Senior Pool Position",
                          percentage: computePercentage(
                            sharesToUsdc(
                              stakedPosition.amount,
                              data.seniorPools[0].latestPoolStatus.sharePrice
                            ).amount,
                            totalUsdc.amount
                          ),
                          quantity: stakedPosition.amount,
                          usdcValue: sharesToUsdc(
                            stakedPosition.amount,
                            data.seniorPools[0].latestPoolStatus.sharePrice
                          ),
                          url: "/pools/senior",
                        })),
                        ...(data.viewer.fiduBalance &&
                        !data.viewer.fiduBalance.amount.isZero()
                          ? [
                              {
                                name: "Unstaked Senior Pool Position",
                                percentage: computePercentage(
                                  sharesToUsdc(
                                    data.viewer.fiduBalance.amount,
                                    data.seniorPools[0].latestPoolStatus
                                      .sharePrice
                                  ).amount,
                                  totalUsdc.amount
                                ),
                                quantity: data.viewer.fiduBalance.amount,
                                usdcValue: sharesToUsdc(
                                  data.viewer.fiduBalance.amount,
                                  data.seniorPools[0].latestPoolStatus
                                    .sharePrice
                                ),
                                url: "/pools/senior",
                              },
                            ]
                          : []),
                      ]}
                      quantityFormatter={(n: BigNumber) =>
                        formatCrypto(
                          { amount: n, token: SupportedCrypto.Fidu },
                          { includeToken: true }
                        )
                      }
                    />
                  ) : null}
                  {(data.viewer.curveLpBalance &&
                    !data.viewer.curveLpBalance.amount.isZero()) ||
                  data.stakedCurveLpPositions.length > 0 ? (
                    <ExpandableHoldings
                      title="Curve Liquidity Provider"
                      tooltip="Tokens earned from providing liquidity on the Goldfinch FIDU/USDC pool on Curve."
                      colorClass={curveColorClass}
                      holdings={[
                        ...data.stakedCurveLpPositions.map(
                          (stakedPosition) => ({
                            name: "Staked Curve LP Tokens",
                            percentage: computePercentage(
                              curveLpTokensToUsdc(
                                stakedPosition.amount,
                                data.curvePool.usdcPerLpToken
                              ).amount,
                              totalUsdc.amount
                            ),
                            quantity: stakedPosition.amount,
                            usdcValue: curveLpTokensToUsdc(
                              stakedPosition.amount,
                              data.curvePool.usdcPerLpToken
                            ),
                            url: "/stake",
                          })
                        ),
                        ...(data.viewer.curveLpBalance &&
                        !data.viewer.curveLpBalance.amount.isZero()
                          ? [
                              {
                                name: "Unstaked LP Tokens",
                                percentage: computePercentage(
                                  curveLpTokensToUsdc(
                                    data.viewer.curveLpBalance.amount,
                                    data.curvePool.usdcPerLpToken
                                  ).amount,
                                  totalUsdc.amount
                                ),
                                quantity: data.viewer.curveLpBalance.amount,
                                usdcValue: curveLpTokensToUsdc(
                                  data.viewer.curveLpBalance.amount,
                                  data.curvePool.usdcPerLpToken
                                ),
                                url: "/stake",
                              },
                            ]
                          : []),
                      ]}
                      quantityFormatter={(n: BigNumber) =>
                        formatCrypto(
                          { token: SupportedCrypto.CurveLp, amount: n },
                          { includeToken: true }
                        )
                      }
                    />
                  ) : null}
                </div>
                <Heading
                  level={2}
                  className="mb-6 !font-sans !text-3xl !font-normal"
                >
                  Activity
                </Heading>
                <TransactionTable isPreview />
              </TabContent>
              <TabContent>
                <Heading
                  level={2}
                  className="mb-6 !font-sans !text-3xl !font-normal"
                >
                  Activity
                </Heading>
                <TransactionTable />
              </TabContent>
            </TabPanels>
          </TabGroup>
        </div>
      )}
    </div>
  );
}

function gfiToUsdc(gfi: CryptoAmount, fiatPerGfi: number): CryptoAmount {
  const formattedGfi = utils.formatUnits(gfi.amount, GFI_DECIMALS);
  const usdcPerGfi = FixedNumber.from(fiatPerGfi.toString()).mulUnsafe(
    FixedNumber.from(Math.pow(10, USDC_DECIMALS).toString())
  );
  const amount = FixedNumber.from(formattedGfi).mulUnsafe(usdcPerGfi);
  return {
    token: SupportedCrypto.Usdc,
    amount: BigNumber.from(amount.toString().split(".")[0]),
  };
}

function curveLpTokensToUsdc(
  lpTokens: BigNumber,
  usdPerCurveLpToken: FixedNumber
) {
  const usdcValue = usdPerCurveLpToken
    .mulUnsafe(FixedNumber.from(lpTokens))
    .round();
  return {
    amount: BigNumber.from(usdcValue.toString().split(".")[0]),
    token: SupportedCrypto.Usdc,
  };
}

function computePercentage(n: BigNumber, total: BigNumber): number {
  if (total.isZero()) {
    return 0;
  }
  return FixedNumber.from(n).divUnsafe(FixedNumber.from(total)).toUnsafeFloat();
}
