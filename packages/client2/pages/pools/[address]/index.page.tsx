import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useRouter } from "next/router";

import {
  Breadcrumb,
  Button,
  Chip,
  Stat,
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
  Heading,
  Paragraph,
  ShimmerLines,
  HelperText,
  Marquee,
} from "@/components/design-system";
import { SubnavPortal } from "@/components/layout";
import { SEO } from "@/components/seo";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SupportedCrypto,
  useSingleTranchedPoolDataQuery,
} from "@/lib/graphql/generated";
import {
  PoolStatus,
  getTranchedPoolStatus,
  computeApyFromGfiInFiat,
  TRANCHED_POOL_STATUS_FIELDS,
} from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import ComingSoonPanel from "./coming-soon-panel";
import FundingBar from "./funding-bar";
import PoolFilledPanel from "./pool-filled-panel";
import SupplyPanel, { SUPPLY_PANEL_FIELDS } from "./supply-panel";
import {
  WithdrawalPanel,
  WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS,
} from "./withdrawal-panel";

gql`
  ${TRANCHED_POOL_STATUS_FIELDS}
  ${SUPPLY_PANEL_FIELDS}
  ${WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS}
  query SingleTranchedPoolData(
    $tranchedPoolId: ID!
    $tranchedPoolAddress: String!
    $userId: ID!
  ) {
    tranchedPool(id: $tranchedPoolId) {
      id
      name @client
      category @client
      icon @client
      description @client
      agreement @client
      dataroom @client
      poolDescription @client
      poolHighlights @client
      borrowerDescription @client
      borrowerHighlights @client
      estimatedJuniorApy
      estimatedJuniorApyFromGfiRaw
      estimatedLeverageRatio
      fundableAt
      isPaused
      numBackers
      seniorTranches {
        principalDeposited
      }
      juniorTranches {
        principalDeposited
      }
      creditLine {
        id
        limit
        maxLimit
        paymentPeriodInDays
        termInDays
        nextDueTime
      }
      ...TranchedPoolStatusFields
      ...SupplyPanelFields
    }
    gfiPrice @client {
      price {
        amount
        symbol
      }
    }
    user(id: $userId) {
      id
      tokens(where: { tranchedPool: $tranchedPoolAddress }) {
        ...WithdrawalPanelPoolTokenFields
      }
    }
  }
`;

// Dummy data
const tags = [
  "Latin America",
  "Women-Owned Businesses",
  "Secured Loan",
  "Ethical Supply Chain",
  "Small Businesses",
];

export default function PoolPage() {
  const {
    query: { address },
  } = useRouter();
  const { account } = useWallet();

  const { data, error } = useSingleTranchedPoolDataQuery({
    skip: !address,
    variables: {
      tranchedPoolId: address as string,
      tranchedPoolAddress: address as string,
      userId: account?.toLowerCase() ?? "",
    },
    returnPartialData: true, // This is turned on that if you connect your wallet on this page, it doesn't wipe out `data` as the query re-runs with the user param
  });

  const tranchedPool = data?.tranchedPool;
  const fiatPerGfi = data?.gfiPrice.price.amount;

  function share() {
    if (navigator && window) {
      navigator.share({
        title: data?.tranchedPool?.name || "Goldfinch",
        url: window.location.href,
      });
    }
  }

  if (error) {
    return (
      <div className="text-2xl">
        Unable to load the specified tranched pool.
      </div>
    );
  }

  const poolStatus = tranchedPool ? getTranchedPoolStatus(tranchedPool) : null;
  const backerSupply = tranchedPool?.juniorTranches
    ? {
        token: SupportedCrypto.Usdc,
        amount: tranchedPool.juniorTranches.reduce((total, curr) => {
          return total.add(curr.principalDeposited);
        }, BigNumber.from(0)),
      }
    : undefined;
  const seniorSupply =
    backerSupply && tranchedPool
      ? {
          token: SupportedCrypto.Usdc,
          amount: backerSupply.amount.mul(tranchedPool.estimatedLeverageRatio),
        }
      : undefined;

  return (
    <>
      <SEO title={tranchedPool?.name} />

      {poolStatus && (
        <SubnavPortal>
          <Marquee
            colorScheme={
              poolStatus === PoolStatus.Full
                ? "yellow"
                : poolStatus === PoolStatus.Open
                ? "purple"
                : poolStatus === PoolStatus.ComingSoon
                ? "blue"
                : poolStatus === PoolStatus.Repaid
                ? "purple"
                : "yellow"
            }
          >
            {poolStatus === PoolStatus.Full
              ? ["Filled", `${tranchedPool?.numBackers} Backers`]
              : poolStatus === PoolStatus.Open
              ? ["Open", `${tranchedPool?.numBackers} Backers`]
              : poolStatus === PoolStatus.ComingSoon
              ? "Coming Soon"
              : poolStatus === PoolStatus.Repaid
              ? "Repaid"
              : "Paused"}
          </Marquee>
        </SubnavPortal>
      )}

      <div className="mb-8 flex flex-row justify-between">
        <div>
          <Breadcrumb label={tranchedPool?.name} image={tranchedPool?.icon} />
        </div>
        <div>
          <Button
            variant="rounded"
            colorScheme="secondary"
            className="mr-2"
            onClick={share}
          >
            Share
          </Button>
          <Button
            variant="rounded"
            colorScheme="secondary"
            iconRight="ArrowTopRight"
          >
            Contract
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-10 ">
        <div className="col-span-8">
          <Heading level={1} className="mb-3 font-serif text-sand-800">
            {tranchedPool ? (
              tranchedPool.name
            ) : (
              <ShimmerLines truncateFirstLine={false} lines={2} />
            )}
          </Heading>

          <div className="mb-12 flex flex-wrap gap-1">
            {tags.map((t) => (
              <Chip key={`tag-${t}`}>{t}</Chip>
            ))}
          </div>

          {error ? (
            <HelperText isError className="mb-2">
              There was a problem fetching data on this pool. Shown data may be
              outdated.
            </HelperText>
          ) : null}

          <div className="mb-15 grid grid-cols-3 rounded-lg border border-eggplant-50">
            {tranchedPool &&
            fiatPerGfi &&
            poolStatus === PoolStatus.ComingSoon ? (
              <>
                <div className="border-r border-b border-eggplant-50 p-5">
                  <Stat
                    label="Total est. APY"
                    value={formatPercent(
                      tranchedPool.estimatedJuniorApy.addUnsafe(
                        computeApyFromGfiInFiat(
                          tranchedPool.estimatedJuniorApyFromGfiRaw,
                          fiatPerGfi
                        )
                      )
                    )}
                    tooltip={
                      <div>
                        <div className="mb-4 text-xl font-bold">
                          Total Estimated APY
                        </div>
                        <div>
                          Lorem ipsum dolor, sit amet consectetur adipisicing
                          elit. Distinctio earum pariatur quod. Voluptatem
                          mollitia doloribus.
                        </div>
                      </div>
                    }
                  />
                </div>

                <div className="border-b border-r border-eggplant-50 p-5">
                  <Stat
                    label="Est $USDC APY"
                    value={formatPercent(tranchedPool.estimatedJuniorApy)}
                    tooltip={
                      <div>
                        <div className="mb-4 text-xl font-bold">
                          Estimated $USDC APY
                        </div>
                        <div>
                          Lorem ipsum dolor, sit amet consectetur adipisicing
                          elit. Distinctio earum pariatur quod. Voluptatem
                          mollitia doloribus.
                        </div>
                      </div>
                    }
                  />
                </div>

                <div className="border-eggplant-50 p-5">
                  <Stat
                    label="Est $GFI APY"
                    value={formatPercent(
                      computeApyFromGfiInFiat(
                        tranchedPool.estimatedJuniorApyFromGfiRaw,
                        fiatPerGfi
                      )
                    )}
                    tooltip={
                      <div>
                        <div className="mb-4 text-xl font-bold">
                          Estimated $GFI APY
                        </div>
                        <div>
                          Lorem ipsum dolor, sit amet consectetur adipisicing
                          elit. Distinctio earum pariatur quod. Voluptatem
                          mollitia doloribus.
                        </div>
                      </div>
                    }
                  />
                </div>
              </>
            ) : (
              <div className="col-span-3 border-b border-eggplant-50 p-5">
                <FundingBar
                  goal={
                    tranchedPool?.creditLine.maxLimit
                      ? {
                          token: SupportedCrypto.Usdc,
                          amount: tranchedPool.creditLine.maxLimit,
                        }
                      : undefined
                  }
                  backerSupply={backerSupply}
                  seniorSupply={seniorSupply}
                />
              </div>
            )}

            <div className="border-r border-eggplant-50 p-5">
              <Stat
                label="Drawdown cap"
                value={
                  tranchedPool
                    ? formatCrypto({
                        token: SupportedCrypto.Usdc,
                        amount: !tranchedPool.creditLine.limit.eq(
                          BigNumber.from("0")
                        )
                          ? tranchedPool.creditLine.limit
                          : tranchedPool.creditLine.maxLimit,
                      })
                    : null
                }
                tooltip={
                  <div>
                    <div className="mb-4 text-xl font-bold">Drawdown cap</div>
                    <div>
                      Lorem ipsum dolor, sit amet consectetur adipisicing elit.
                      Distinctio earum pariatur quod. Voluptatem mollitia
                      doloribus.
                    </div>
                  </div>
                }
              />
            </div>
            <div className="border-r border-eggplant-50 p-5">
              <Stat
                label="Payment Term"
                value={tranchedPool?.creditLine?.termInDays.toString()}
                tooltip={
                  <div>
                    <div className="mb-4 text-xl font-bold">Payment Term</div>
                    <div>
                      Lorem ipsum dolor, sit amet consectetur adipisicing elit.
                      Distinctio earum pariatur quod. Voluptatem mollitia
                      doloribus.
                    </div>
                  </div>
                }
              />
            </div>
            <div className="p-5">
              <Stat
                label="Payment frequency"
                value={`${tranchedPool?.creditLine?.paymentPeriodInDays.toString()} days`}
                tooltip={
                  <div>
                    <div className="mb-4 text-xl font-bold">
                      Payment frequency
                    </div>
                    <div>
                      Lorem ipsum dolor, sit amet consectetur adipisicing elit.
                      Distinctio earum pariatur quod. Voluptatem mollitia
                      doloribus.
                    </div>
                  </div>
                }
              />
            </div>
          </div>

          <div>
            <TabGroup>
              <TabList>
                <TabButton>Deal Overview</TabButton>
                <TabButton>Borrower Profile</TabButton>
              </TabList>
              <TabPanels>
                <TabContent>
                  <Heading
                    as="h3"
                    level={5}
                    className="mb-8 font-sans font-normal"
                  >
                    Overview
                  </Heading>
                  <Paragraph className="mb-10 whitespace-pre-wrap !text-2xl">
                    {tranchedPool?.description}
                  </Paragraph>

                  <Heading
                    level={4}
                    className="mb-4 font-sans !text-lg !font-semibold"
                  >
                    Pool Overview
                  </Heading>
                  <Paragraph className="mb-10 whitespace-pre-wrap">
                    {tranchedPool?.poolDescription}
                  </Paragraph>

                  <Heading
                    level={4}
                    className="mb-4 font-sans !text-lg !font-semibold"
                  >
                    Highlights
                  </Heading>
                  <ul className="list-outside list-disc pl-5">
                    {tranchedPool?.poolHighlights?.map((item, idx) => (
                      <li
                        key={`pool-highlight-${address}-${idx}`}
                        className="py-1"
                      >
                        <Paragraph className="whitespace-pre-wrap">
                          {item}
                        </Paragraph>
                      </li>
                    ))}
                  </ul>
                </TabContent>
                <TabContent>
                  <Heading
                    as="h3"
                    level={5}
                    className="mb-8 font-sans font-normal"
                  >
                    Overview
                  </Heading>
                  <Paragraph className="mb-10 whitespace-pre-wrap">
                    {tranchedPool?.borrowerDescription}
                  </Paragraph>

                  <Heading
                    level={4}
                    className="mb-4 font-sans !text-lg !font-semibold"
                  >
                    Highlights
                  </Heading>
                  <ul className="list-outside list-disc pl-5">
                    {tranchedPool?.borrowerHighlights?.map((item, idx) => (
                      <li
                        key={`borrower-highlight-${address}-${idx}`}
                        className="py-1"
                      >
                        <Paragraph className="whitespace-pre-wrap">
                          {item}
                        </Paragraph>
                      </li>
                    ))}
                  </ul>
                </TabContent>
              </TabPanels>
            </TabGroup>
          </div>
        </div>

        <div className="relative col-span-4">
          {tranchedPool && fiatPerGfi ? (
            <div className="sticky top-12 space-y-8">
              {poolStatus === PoolStatus.Open && (
                <SupplyPanel
                  tranchedPool={tranchedPool}
                  fiatPerGfi={fiatPerGfi}
                />
              )}

              {poolStatus === PoolStatus.Full && (
                <PoolFilledPanel
                  limit={tranchedPool.creditLine.limit}
                  apy={tranchedPool.estimatedJuniorApy}
                  apyGfi={tranchedPool.estimatedJuniorApyFromGfiRaw}
                  dueDate={tranchedPool.creditLine.nextDueTime}
                />
              )}

              {poolStatus === PoolStatus.ComingSoon && (
                <ComingSoonPanel fundableAt={tranchedPool?.fundableAt} />
              )}

              {data?.user && data?.user.tokens.length > 0 ? (
                <WithdrawalPanel
                  tranchedPoolAddress={tranchedPool.id}
                  poolTokens={data.user.tokens}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
