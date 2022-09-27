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
import { GFI_DECIMALS, USDC_DECIMALS } from "@/constants";
import {
  stitchGrantsWithTokens,
  sumTotalClaimable,
  sumTotalLocked,
} from "@/lib/gfi-rewards";
import {
  CryptoAmount,
  SupportedCrypto,
  useDashboardPageQuery,
  DashboardPageQuery,
} from "@/lib/graphql/generated";
import { sharesToUsdc, sum } from "@/lib/pools";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import {
  ExpandableHoldings,
  ExpandableHoldingsPlaceholder,
} from "./expandable-holdings";
import { FormatWithIcon } from "./format-with-icon";
import {
  PortfolioSummary,
  PortfolioSummaryPlaceholder,
} from "./portfolio-summary";
import { TransactionTable } from "./transaction-table";

gql`
  fragment StakedPositionFields on SeniorPoolStakedPosition {
    id
    amount
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
      principalRedeemable
      principalRedeemed
      interestRedeemable
      interestRedeemed
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
      data.pastAndCurrentSeniorPoolPositions
    );
    const gfiTotalLocked = sumTotalLocked(
      grantsWithTokens,
      data.pastAndCurrentSeniorPoolPositions
    );
    return gfiTotalClaimable.add(gfiTotalLocked);
  }, [data]);

  const { summaryHoldings, totalUsdc } = useMemo(() => {
    if (!data) {
      return {};
    }
    const borrowerPoolTotal = {
      token: SupportedCrypto.Usdc,
      amount: data.tranchedPoolTokens.reduce(
        (prev, current) => prev.add(valueOfPoolToken(current)),
        BigNumber.from(0)
      ),
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
  }, [data, gfiRewardsTotal]);

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
                {!data || !totalUsdc || !summaryHoldings || loading ? (
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
                      {data.tranchedPoolTokens.length > 0 ? (
                        <ExpandableHoldings
                          title="Backer Positions"
                          tooltip="Your active investment in Goldfinch Borrower Pools. Each investment position, including its claimable interest, is represented by a unique Backer PoolToken NFT held in your linked wallet."
                          colorClass={borrowerPoolColorClass}
                          holdings={data.tranchedPoolTokens.map((token) => ({
                            name: token.tranchedPool.name,
                            percentage: computePercentage(
                              valueOfPoolToken(token),
                              totalUsdc.amount
                            ),
                            quantity: BigNumber.from(1),
                            usdcValue: {
                              token: SupportedCrypto.Usdc,
                              amount: valueOfPoolToken(token),
                            },
                            url: `/pools/${token.tranchedPool.id}`,
                          }))}
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
                      !gfiRewardsTotal.isZero() ? (
                        <ExpandableHoldings
                          title="GFI"
                          tooltip="Your GFI token holdings, including your claimable GFI rewards, locked GFI rewards, and any GFI held in your linked wallet."
                          colorClass={gfiColorClass}
                          holdings={[
                            ...(data.viewer.gfiBalance &&
                            !data.viewer.gfiBalance.amount.isZero()
                              ? [
                                  {
                                    name: "Wallet Holdings",
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
                          quantityFormatter={(n: BigNumber) => (
                            <FormatWithIcon
                              cryptoAmount={{
                                token: SupportedCrypto.Gfi,
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
                      data.stakedFiduPositions.length > 0 ? (
                        <ExpandableHoldings
                          title="Senior Pool Position"
                          tooltip="Your active investment in the Goldfinch Senior Pool, represented by the value of your FIDU token holdings. This includes FIDU held in your linked wallet and any FIDU you are staking."
                          colorClass={seniorPoolColorClass}
                          holdings={[
                            ...data.stakedFiduPositions.map(
                              (stakedPosition) => ({
                                name: "Staked Senior Pool Position",
                                percentage: computePercentage(
                                  sharesToUsdc(
                                    stakedPosition.amount,
                                    data.seniorPools[0].latestPoolStatus
                                      .sharePrice
                                  ).amount,
                                  totalUsdc.amount
                                ),
                                quantity: stakedPosition.amount,
                                usdcValue: sharesToUsdc(
                                  stakedPosition.amount,
                                  data.seniorPools[0].latestPoolStatus
                                    .sharePrice
                                ),
                                url: "/pools/senior",
                              })
                            ),
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
                          quantityFormatter={(n: BigNumber) => (
                            <FormatWithIcon
                              cryptoAmount={{
                                amount: n,
                                token: SupportedCrypto.Fidu,
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
                          quantityFormatter={(n: BigNumber) => (
                            <FormatWithIcon
                              cryptoAmount={{
                                token: SupportedCrypto.CurveLp,
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
  tranchedPoolToken: DashboardPageQuery["tranchedPoolTokens"][number]
): BigNumber {
  const value = tranchedPoolToken.principalAmount
    .add(tranchedPoolToken.principalRedeemable)
    .add(tranchedPoolToken.interestRedeemable)
    .sub(tranchedPoolToken.principalRedeemed)
    .sub(tranchedPoolToken.interestRedeemed);
  if (value.isNegative()) {
    return BigNumber.from(0);
  }
  return value;
}
