import { gql } from "@apollo/client";
import { BigNumber, FixedNumber, utils } from "ethers";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import {
  Button,
  Heading,
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { CURVE_LP_DECIMALS, USDC_DECIMALS } from "@/constants";
import { computePercentage } from "@/lib/format";
import {
  stitchGrantsWithTokens,
  sumTotalClaimable,
  sumTotalLocked,
} from "@/lib/gfi-rewards";
import {
  useDashboardPageQuery,
  DashboardPoolTokenFieldsFragment,
  DashboardStakedPositionFieldsFragment,
} from "@/lib/graphql/generated";
import { sharesToUsdc, sum, gfiToUsdc } from "@/lib/pools";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet2 } from "@/lib/wallet";

import {
  ExpandableHoldings,
  ExpandableHoldingsPlaceholder,
  Holding,
} from "./expandable-holdings";
import { FormatWithIcon } from "./format-with-icon";
import {
  PortfolioSummary,
  PortfolioSummaryPlaceholder,
} from "./portfolio-summary";
import { TransactionTable } from "./transaction-table";

gql`
  fragment DashboardStakedPositionFields on SeniorPoolStakedPosition {
    id
    amount
  }
  fragment DashboardPoolTokenFields on PoolToken {
    id
    principalAmount
    principalRedeemed
    interestRedeemable
    rewardsClaimable
    stakingRewardsClaimable
    loan {
      id
      name @client
    }
  }
  query DashboardPage($userId: String!) {
    seniorPools {
      id
      sharePrice
    }
    viewer @client {
      fiduBalance
      gfiBalance
      curveLpBalance
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
      claimableMembershipRewards
    }
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
      }
    }
    vaultedGfis(where: { user: $userId }) {
      id
      amount
    }
    curvePool @client {
      usdPerLpToken
    }
    poolTokens(
      where: { user: $userId, principalAmount_gt: 0 }
      orderBy: mintedAt
      orderDirection: desc
    ) {
      ...DashboardPoolTokenFields
    }
    vaultedPoolTokens(where: { user: $userId }) {
      id
      poolToken {
        ...DashboardPoolTokenFields
      }
    }
    stakedFiduPositions: seniorPoolStakedPositions(
      where: { user: $userId, amount_gt: 0, positionType: Fidu }
      orderBy: startTime
      orderDirection: desc
    ) {
      ...DashboardStakedPositionFields
    }
    vaultedStakedPositions(where: { user: $userId }) {
      id
      seniorPoolStakedPosition {
        ...DashboardStakedPositionFields
      }
    }
    stakedCurveLpPositions: seniorPoolStakedPositions(
      where: { user: $userId, amount_gt: 0, positionType: CurveLP }
      orderBy: startTime
      orderDirection: desc
    ) {
      ...DashboardStakedPositionFields
    }
    # Need to include old staked positions that have been unstaked, because they can still have some GFI vesting
    pastAndCurrentSeniorPoolPositions: seniorPoolStakedPositions(
      where: { user: $userId }
    ) {
      id
      claimable @client
      granted @client
      totalRewardsClaimed
    }
    communityRewardsTokens(where: { user: $userId }) {
      id
      source
      index
      totalClaimed
    }
    seniorPoolWithdrawalRequests(where: { user: $userId }, first: 1) {
      id
      fiduRequested
    }
  }
`;

const borrowerPoolColorClass = "bg-eggplant-300";
const gfiColorClass = "bg-mustard-450";
const seniorPoolColorClass = "bg-mint-300";
const curveColorClass = "bg-tidepool-600";

export default function DashboardPage() {
  const { account } = useWallet2();
  const { data, loading, error } = useDashboardPageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
  });

  const sharePrice = data?.seniorPools[0].sharePrice;

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
      data.poolTokens,
      data.pastAndCurrentSeniorPoolPositions
    );
    const gfiTotalLocked = sumTotalLocked(
      grantsWithTokens,
      data.pastAndCurrentSeniorPoolPositions
    );
    return gfiTotalClaimable.add(gfiTotalLocked);
  }, [data]);

  const gfiVaultedTotal = useMemo(() => {
    if (!data) {
      return BigNumber.from(0);
    }
    return sum("amount", data.vaultedGfis);
  }, [data]);

  const { summaryHoldings, totalUsdc } = useMemo(() => {
    if (!data || !sharePrice || !data.viewer.gfiBalance) {
      return {};
    }
    const borrowerPoolTotal = {
      token: "USDC",
      amount: data.poolTokens
        .concat(data.vaultedPoolTokens.map((v) => v.poolToken))
        .reduce(
          (prev, current) => prev.add(valueOfPoolToken(current)),
          BigNumber.from(0)
        ),
    } as const;

    const gfiTotal = gfiToUsdc(
      {
        token: "GFI",
        amount: data.viewer.gfiBalance.amount
          .add(gfiRewardsTotal)
          .add(gfiVaultedTotal),
      },
      data.gfiPrice.price.amount
    );

    const seniorPoolTotal = sharesToUsdc(
      sum(
        "amount",
        data.stakedFiduPositions.concat(
          data.vaultedStakedPositions.map((v) => v.seniorPoolStakedPosition)
        )
      )
        .add(data.viewer.fiduBalance?.amount ?? BigNumber.from(0))
        .add(
          data.viewer.claimableMembershipRewards?.amount ?? BigNumber.from(0)
        )
        .add(
          data.seniorPoolWithdrawalRequests[0]?.fiduRequested ??
            BigNumber.from(0)
        ),
      sharePrice
    );

    const curveLpTotal = curveLpTokensToUsdc(
      sum("amount", data.stakedCurveLpPositions).add(
        data.viewer.curveLpBalance
          ? data.viewer.curveLpBalance.amount
          : BigNumber.from(0)
      ),
      data.curvePool.usdPerLpToken
    );

    const totalUsdc = {
      token: "USDC",
      amount: sum("amount", [
        borrowerPoolTotal,
        gfiTotal,
        seniorPoolTotal,
        curveLpTotal,
      ]),
    } as const;

    const summaryHoldings = [
      {
        name: "Backer Positions",
        tooltip:
          "Your active investment in Borrower Pools, represented by your Backer PoolToken NFTs.",
        usdc: borrowerPoolTotal,
        colorClass: borrowerPoolColorClass,
        percentage: computePercentage(
          borrowerPoolTotal.amount,
          totalUsdc.amount
        ),
      },
      {
        name: "GFI",
        tooltip:
          "Your GFI token holdings, including claimable and locked GFI rewards.",
        usdc: gfiTotal,
        percentage: computePercentage(gfiTotal.amount, totalUsdc.amount),
        colorClass: gfiColorClass,
      },
      {
        name: "Senior Pool Position",
        tooltip:
          "Your active investment in the Senior Pool, represented by the value of your FIDU token holdings.",
        usdc: seniorPoolTotal,
        percentage: computePercentage(seniorPoolTotal.amount, totalUsdc.amount),
        colorClass: seniorPoolColorClass,
      },
      {
        name: "Curve LP Tokens",
        tooltip:
          "The value of your crvFIDU-USDC tokens, representing your FIDU-USDC LP position on Curve.",
        usdc: curveLpTotal,
        percentage: computePercentage(curveLpTotal.amount, totalUsdc.amount),
        colorClass: curveColorClass,
      },
    ];

    return {
      totalUsdc,
      summaryHoldings,
    };
  }, [data, sharePrice, gfiRewardsTotal, gfiVaultedTotal]);

  const [expanded, setExpanded] = useState({
    borrower: false,
    gfi: false,
    senior: false,
    curve: false,
  });
  const areAllSectionsExpanded = !Object.values(expanded).includes(false);

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  // Cheap trick to allow links to /dashboard#activity
  // If more tabs get added and we need to link to the tab internals, this might have to become more robust.
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    const hash = new URL(router.asPath, "https://placeholder.com").hash;
    if (!hash) {
      return;
    } else if (hash === "#activity") {
      setSelectedTabIndex(1);
    }
  }, [router.asPath, router.isReady]);

  return (
    <div>
      <Heading level={1} className="mb-12">
        Dashboard
      </Heading>
      {!account && !loading ? (
        <div className="text-lg font-medium text-clay-500">
          You must connect your wallet to view your dashboard
          <div className="mt-3">
            <Button size="xl" onClick={openWalletModal}>
              Connect Wallet
            </Button>
          </div>
        </div>
      ) : error ? (
        <div className="text-clay-500">Error: {error.message}</div>
      ) : (
        <div>
          <TabGroup
            selectedIndex={selectedTabIndex}
            onChange={setSelectedTabIndex}
          >
            <TabList>
              <TabButton>Overview</TabButton>
              <TabButton>Activity</TabButton>
            </TabList>
            <TabPanels>
              <TabContent>
                {!data ||
                !totalUsdc ||
                !sharePrice ||
                !summaryHoldings ||
                loading ? (
                  <>
                    <PortfolioSummaryPlaceholder className="mb-15" />
                    <Heading level={3} className="mb-6 !font-sans !text-xl">
                      Holdings
                    </Heading>
                    <div className="space-y-3">
                      {[0, 1, 2, 3].map((nonce) => (
                        <ExpandableHoldingsPlaceholder key={nonce} />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <PortfolioSummary
                      className="mb-15"
                      holdings={summaryHoldings}
                      totalUsdc={totalUsdc}
                    />
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <Heading level={3} className="!font-sans !text-xl">
                        Holdings
                      </Heading>
                      <Button
                        colorScheme="secondary"
                        variant="rounded"
                        onClick={() =>
                          areAllSectionsExpanded
                            ? setExpanded(setAll(expanded, false))
                            : setExpanded(setAll(expanded, true))
                        }
                      >
                        {areAllSectionsExpanded ? "Collapse all" : "Expand all"}
                      </Button>
                    </div>
                    <div className="mb-24 space-y-3">
                      {totalUsdc.amount.isZero() ? (
                        <div className="rounded bg-sand-50 p-3 text-center text-sm text-sand-400">
                          You have no holdings in Goldfinch yet
                        </div>
                      ) : null}
                      {data.poolTokens.length > 0 ||
                      data.vaultedPoolTokens.length > 0 ? (
                        <ExpandableHoldings
                          title="Backer Positions"
                          tooltip="Your active investment in Goldfinch Borrower Pools. Each investment position, including its claimable interest, is represented by a unique Backer PoolToken NFT held in your linked wallet."
                          colorClass={borrowerPoolColorClass}
                          holdings={data.poolTokens
                            .map((poolToken) =>
                              transformPoolTokenToHolding(poolToken, totalUsdc)
                            )
                            .concat(
                              data.vaultedPoolTokens.map((v) =>
                                transformPoolTokenToHolding(
                                  v.poolToken,
                                  totalUsdc,
                                  true
                                )
                              )
                            )}
                          quantityFormatter={(n: BigNumber) =>
                            `${n.toString()} NFT${
                              n.gt(BigNumber.from(1)) ? "s" : ""
                            }`
                          }
                          isExpanded={expanded["borrower"]}
                          onClick={() =>
                            setExpanded({
                              ...expanded,
                              borrower: !expanded.borrower,
                            })
                          }
                        />
                      ) : null}
                      {(data.viewer.gfiBalance &&
                        !data.viewer.gfiBalance.amount.isZero()) ||
                      !gfiRewardsTotal.isZero() ||
                      !gfiVaultedTotal.isZero() ? (
                        <ExpandableHoldings
                          title="GFI"
                          tooltip="Your GFI token holdings, including your claimable GFI rewards, locked GFI rewards, and any GFI held in your linked wallet."
                          colorClass={gfiColorClass}
                          holdings={[
                            ...(data.viewer.gfiBalance &&
                            !data.viewer.gfiBalance.amount.isZero()
                              ? [
                                  transformGfiToHolding({
                                    name: "Wallet Holdings",
                                    gfi: data.viewer.gfiBalance,
                                    fiatPerGfi: data.gfiPrice.price.amount,
                                    totalUsdc,
                                  }),
                                ]
                              : []),
                            ...(!gfiRewardsTotal.isZero()
                              ? [
                                  transformGfiToHolding({
                                    name: "GFI Rewards",
                                    gfi: {
                                      token: "GFI",
                                      amount: gfiRewardsTotal,
                                    },
                                    fiatPerGfi: data.gfiPrice.price.amount,
                                    totalUsdc,
                                    url: "/gfi",
                                  }),
                                ]
                              : []),
                            ...(!gfiVaultedTotal.isZero()
                              ? [
                                  transformGfiToHolding({
                                    name: "Vaulted GFI",
                                    url: "/membership",
                                    vaulted: true,
                                    gfi: {
                                      token: "GFI",
                                      amount: gfiVaultedTotal,
                                    },
                                    fiatPerGfi: data.gfiPrice.price.amount,
                                    totalUsdc,
                                  }),
                                ]
                              : []),
                          ]}
                          quantityFormatter={(n: BigNumber) => (
                            <FormatWithIcon
                              cryptoAmount={{
                                token: "GFI",
                                amount: n,
                              }}
                            />
                          )}
                          isExpanded={expanded["gfi"]}
                          onClick={() =>
                            setExpanded({
                              ...expanded,
                              gfi: !expanded.gfi,
                            })
                          }
                        />
                      ) : null}
                      {(data.viewer.fiduBalance &&
                        !data.viewer.fiduBalance.amount.isZero()) ||
                      data.stakedFiduPositions.length > 0 ||
                      data.vaultedStakedPositions.length > 0 ||
                      data.seniorPoolWithdrawalRequests.length > 0 ? (
                        <ExpandableHoldings
                          title="Senior Pool Position"
                          tooltip="Your active investment in the Goldfinch Senior Pool, represented by the value of your FIDU token holdings. This includes FIDU held in your linked wallet and any FIDU you are staking."
                          colorClass={seniorPoolColorClass}
                          holdings={[
                            ...data.stakedFiduPositions.map((stakedPosition) =>
                              transformStakedPositionToHolding(
                                stakedPosition,
                                totalUsdc,
                                sharePrice
                              )
                            ),
                            ...data.vaultedStakedPositions.map((v) =>
                              transformStakedPositionToHolding(
                                v.seniorPoolStakedPosition,
                                totalUsdc,
                                sharePrice,
                                true
                              )
                            ),
                            ...(data.viewer.fiduBalance &&
                            !data.viewer.fiduBalance.amount.isZero()
                              ? [
                                  transformFiduToHolding({
                                    name: "Unstaked Senior Pool Position",
                                    url: "/pools/senior",
                                    fidu: data.viewer.fiduBalance,
                                    totalUsdc,
                                    sharePrice,
                                  }),
                                ]
                              : []),
                            ...(data.viewer.claimableMembershipRewards &&
                            !data.viewer.claimableMembershipRewards.amount.isZero()
                              ? [
                                  transformFiduToHolding({
                                    name: "Claimable Member Earnings",
                                    url: "/membership",
                                    fidu: data.viewer
                                      .claimableMembershipRewards,
                                    sharePrice,
                                    totalUsdc,
                                  }),
                                ]
                              : []),
                            ...(data.seniorPoolWithdrawalRequests.length > 0 &&
                            !data.seniorPoolWithdrawalRequests[0].fiduRequested.isZero()
                              ? [
                                  transformFiduToHolding({
                                    name: "Requested for withdrawal",
                                    url: "/pools/senior",
                                    fidu: {
                                      token: "FIDU",
                                      amount:
                                        data.seniorPoolWithdrawalRequests[0]
                                          .fiduRequested,
                                    },
                                    sharePrice,
                                    totalUsdc,
                                  }),
                                ]
                              : []),
                          ]}
                          quantityFormatter={(n: BigNumber) => (
                            <FormatWithIcon
                              cryptoAmount={{
                                amount: n,
                                token: "FIDU",
                              }}
                            />
                          )}
                          isExpanded={expanded["senior"]}
                          onClick={() =>
                            setExpanded({
                              ...expanded,
                              senior: !expanded.senior,
                            })
                          }
                        />
                      ) : null}
                      {(data.viewer.curveLpBalance &&
                        !data.viewer.curveLpBalance.amount.isZero()) ||
                      data.stakedCurveLpPositions.length > 0 ? (
                        <ExpandableHoldings
                          title="Curve LP Tokens"
                          tooltip="The value of your crvFIDU-USDC tokens, received on Curve for participating as a liquidity provider in the Curve FIDU-USDC Pool. This includes crvFIDU-USDC tokens you are staking on Goldfinch and any held in your linked wallet."
                          colorClass={curveColorClass}
                          holdings={[
                            ...data.stakedCurveLpPositions.map(
                              (stakedPosition) => ({
                                name: "Staked Curve LP Tokens",
                                percentage: computePercentage(
                                  curveLpTokensToUsdc(
                                    stakedPosition.amount,
                                    data.curvePool.usdPerLpToken
                                  ).amount,
                                  totalUsdc.amount
                                ),
                                quantity: stakedPosition.amount,
                                usdcValue: curveLpTokensToUsdc(
                                  stakedPosition.amount,
                                  data.curvePool.usdPerLpToken
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
                                        data.curvePool.usdPerLpToken
                                      ).amount,
                                      totalUsdc.amount
                                    ),
                                    quantity: data.viewer.curveLpBalance.amount,
                                    usdcValue: curveLpTokensToUsdc(
                                      data.viewer.curveLpBalance.amount,
                                      data.curvePool.usdPerLpToken
                                    ),
                                    url: "/stake",
                                  },
                                ]
                              : []),
                          ]}
                          quantityFormatter={(n: BigNumber) => (
                            <FormatWithIcon
                              cryptoAmount={{
                                token: "CURVE_LP",
                                amount: n,
                              }}
                            />
                          )}
                          isExpanded={expanded["curve"]}
                          onClick={() =>
                            setExpanded({
                              ...expanded,
                              curve: !expanded.curve,
                            })
                          }
                        />
                      ) : null}
                    </div>

                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <Heading
                        level={2}
                        className="!font-sans !text-3xl !font-normal"
                      >
                        Activity
                      </Heading>
                      <Button
                        colorScheme="secondary"
                        variant="rounded"
                        iconRight="ArrowSmRight"
                        onClick={() => setSelectedTabIndex(1)}
                      >
                        View all
                      </Button>
                    </div>
                    <TransactionTable isPreview />
                  </>
                )}
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

function curveLpTokensToUsdc(
  lpTokens: BigNumber,
  usdPerCurveLpToken: FixedNumber
) {
  const usdValue = usdPerCurveLpToken
    .mulUnsafe(FixedNumber.from(utils.formatUnits(lpTokens, CURVE_LP_DECIMALS)))
    .round();
  return {
    amount: utils.parseUnits(usdValue.toString().split(".")[0], USDC_DECIMALS),
    token: "USDC" as const,
  };
}

function setAll<S extends string, T>(
  obj: Record<S, T>,
  value: T
): Record<S, T> {
  return Object.keys(obj).reduce(
    (prev, current) => {
      prev[current as S] = value;
      return prev;
    },
    { ...obj }
  );
}

function valueOfPoolToken(
  tranchedPoolToken: DashboardPoolTokenFieldsFragment
): BigNumber {
  return tranchedPoolToken.principalAmount
    .sub(tranchedPoolToken.principalRedeemed)
    .add(tranchedPoolToken.interestRedeemable);
}

function transformPoolTokenToHolding(
  poolToken: DashboardPoolTokenFieldsFragment,
  totalUsdc: CryptoAmount,
  vaulted = false
): Holding {
  return {
    name: poolToken.loan.name,
    percentage: computePercentage(
      valueOfPoolToken(poolToken),
      totalUsdc.amount
    ),
    quantity: BigNumber.from(1),
    usdcValue: {
      token: "USDC",
      amount: valueOfPoolToken(poolToken),
    },
    url: `/pools/${poolToken.loan.id}`,
    vaulted,
  };
}

function transformStakedPositionToHolding(
  stakedPosition: DashboardStakedPositionFieldsFragment,
  totalUsdc: CryptoAmount,
  sharePrice: BigNumber,
  vaulted = false
): Holding {
  const usdcValue = sharesToUsdc(stakedPosition.amount, sharePrice);
  return {
    name: "Staked Senior Pool Position",
    percentage: computePercentage(usdcValue.amount, totalUsdc.amount),
    quantity: stakedPosition.amount,
    usdcValue: usdcValue,
    url: "/pools/senior",
    vaulted,
  };
}

function transformFiduToHolding({
  name,
  url,
  fidu,
  sharePrice,
  totalUsdc,
}: {
  name: string;
  url: string;
  fidu: CryptoAmount;
  sharePrice: BigNumber;
  totalUsdc: CryptoAmount;
}): Holding {
  const usdcValue = sharesToUsdc(fidu.amount, sharePrice);
  return {
    name,
    percentage: computePercentage(usdcValue.amount, totalUsdc.amount),
    quantity: fidu.amount,
    usdcValue,
    url,
  };
}

function transformGfiToHolding({
  name,
  url,
  gfi,
  fiatPerGfi,
  totalUsdc,
  vaulted,
}: {
  name: string;
  url?: string;
  gfi: CryptoAmount;
  fiatPerGfi: number;
  totalUsdc: CryptoAmount;
  vaulted?: boolean;
}): Holding {
  const usdcValue = gfiToUsdc(gfi, fiatPerGfi);
  return {
    name,
    url,
    vaulted,
    percentage: computePercentage(usdcValue.amount, totalUsdc.amount),
    quantity: gfi.amount,
    usdcValue,
  };
}
