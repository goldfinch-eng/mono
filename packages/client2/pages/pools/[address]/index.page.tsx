import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useRouter } from "next/router";

import {
  Breadcrumb,
  Button,
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
  Banner,
} from "@/components/design-system";
import { BannerPortal, SubnavPortal } from "@/components/layout";
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

import { BorrowerProfile, BORROWER_PROFILE_FIELDS } from "./borrower-profile";
import ComingSoonPanel from "./coming-soon-panel";
import FundingBar from "./funding-bar";
import RepaymentProgressPanel, {
  REPAYMENT_PROGRESS_PANEL_FIELDS,
} from "./repayment-progress-panel";
import SupplyPanel, {
  SUPPLY_PANEL_TRANCHED_POOL_FIELDS,
  SUPPLY_PANEL_USER_FIELDS,
} from "./supply-panel";
import { TransactionTable } from "./transaction-table";
import {
  WithdrawalPanel,
  WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS,
  WITHDRAWAL_PANEL_ZAP_FIELDS,
} from "./withdrawal-panel";

gql`
  ${TRANCHED_POOL_STATUS_FIELDS}
  ${SUPPLY_PANEL_TRANCHED_POOL_FIELDS}
  ${SUPPLY_PANEL_USER_FIELDS}
  ${WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS}
  ${WITHDRAWAL_PANEL_ZAP_FIELDS}
  ${REPAYMENT_PROGRESS_PANEL_FIELDS}
  ${BORROWER_PROFILE_FIELDS}
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
      highlights @client
      agreement @client
      dataroom @client
      estimatedJuniorApy
      estimatedJuniorApyFromGfiRaw
      estimatedLeverageRatio
      fundableAt
      isPaused
      numBackers
      juniorTranches {
        lockedUntil
      }
      juniorDeposited
      creditLine {
        id
        limit
        maxLimit
        paymentPeriodInDays
        termInDays
      }
      ...TranchedPoolStatusFields
      ...SupplyPanelTranchedPoolFields
      ...RepaymentProgressPanelTranchedPoolFields
      ...BorrowerProfileFields
    }
    seniorPools(first: 1) {
      id
      latestPoolStatus {
        id
        estimatedApyFromGfiRaw
        sharePrice
      }
    }
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
      }
    }
    user(id: $userId) {
      id
      ...SupplyPanelUserFields
      tokens(where: { tranchedPool: $tranchedPoolAddress }) {
        ...WithdrawalPanelPoolTokenFields
      }
      zaps(where: { tranchedPool: $tranchedPoolAddress }) {
        ...WithdrawalPanelZapFields
      }
    }
    currentBlock @client {
      timestamp
    }
  }
`;

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
  const seniorPool = data?.seniorPools?.[0];
  const user = data?.user ?? null;
  const fiatPerGfi = data?.gfiPrice.price.amount;

  if (error) {
    return (
      <div className="text-2xl">
        Unable to load the specified tranched pool.
      </div>
    );
  }

  const poolStatus = tranchedPool ? getTranchedPoolStatus(tranchedPool) : null;
  const backerSupply = tranchedPool?.juniorDeposited
    ? {
        token: SupportedCrypto.Usdc,
        amount: tranchedPool.juniorDeposited,
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

      <BannerPortal>
        <Banner
          initialContent="This offering is only available to non-U.S. persons"
          expandedContent="This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."
        />
      </BannerPortal>

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

      <div className="pool-layout">
        <div style={{ gridArea: "heading" }}>
          <div className="mb-10 flex flex-wrap justify-between sm:mb-8">
            <div>
              <Breadcrumb
                label={tranchedPool?.name}
                image={tranchedPool?.icon}
              />
            </div>
            {tranchedPool ? (
              <Button
                variant="rounded"
                colorScheme="secondary"
                iconRight="ArrowTopRight"
                as="a"
                href={`https://etherscan.io/address/${tranchedPool.id}`}
                target="_blank"
                rel="noopener"
              >
                Contract
              </Button>
            ) : null}
          </div>
          <Heading
            level={1}
            className="mb-5 text-center font-serif text-sand-800 sm:mb-3 md:text-left"
          >
            {tranchedPool ? (
              tranchedPool.name
            ) : (
              <ShimmerLines truncateFirstLine={false} lines={2} />
            )}
          </Heading>

          {error ? (
            <HelperText isError className="mb-2">
              There was a problem fetching data on this pool. Shown data may be
              outdated.
            </HelperText>
          ) : null}

          <div className="grid-cols-3 rounded-lg border border-eggplant-50 sm:grid md:mb-15">
            {tranchedPool &&
            fiatPerGfi &&
            poolStatus === PoolStatus.ComingSoon ? (
              <>
                <div className="border-b border-eggplant-50 p-5 md:border-r md:border-b-0">
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

                <div className="border-b border-eggplant-50 p-5 md:border-r md:border-b-0">
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

            <div className="border-b border-eggplant-50 p-5 md:border-b-0 md:border-r">
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
            <div className="border-b border-eggplant-50 p-5 md:border-b-0 md:border-r">
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
        </div>

        <div className="relative" style={{ gridArea: "widgets" }}>
          {tranchedPool && seniorPool && fiatPerGfi ? (
            <div className="flex flex-col items-stretch gap-8 lg:sticky lg:top-12">
              {poolStatus === PoolStatus.Full && (
                <RepaymentProgressPanel tranchedPool={tranchedPool} />
              )}

              {data?.user &&
              (data?.user.tokens.length > 0 || data?.user.zaps.length > 0) ? (
                <WithdrawalPanel
                  tranchedPoolAddress={tranchedPool.id}
                  poolTokens={data.user.tokens}
                  zaps={data.user.zaps}
                  isPoolLocked={
                    !tranchedPool.juniorTranches[0].lockedUntil.isZero() &&
                    BigNumber.from(data?.currentBlock?.timestamp ?? 0).gt(
                      tranchedPool.juniorTranches[0].lockedUntil
                    )
                  }
                />
              ) : null}

              {poolStatus === PoolStatus.Open && (
                <SupplyPanel
                  tranchedPool={tranchedPool}
                  user={user}
                  fiatPerGfi={fiatPerGfi}
                  seniorPoolApyFromGfiRaw={
                    seniorPool.latestPoolStatus.estimatedApyFromGfiRaw
                  }
                  seniorPoolSharePrice={seniorPool.latestPoolStatus.sharePrice}
                />
              )}

              {poolStatus === PoolStatus.ComingSoon && (
                <ComingSoonPanel fundableAt={tranchedPool?.fundableAt} />
              )}
            </div>
          ) : null}
        </div>

        <div style={{ gridArea: "info" }}>
          <TabGroup>
            <TabList>
              <TabButton>Deal Overview</TabButton>
              <TabButton>Borrower Profile</TabButton>
            </TabList>
            <TabPanels>
              <TabContent>
                <h2 className="mb-8 text-3xl">Deal Overview</h2>
                <Paragraph className="mb-8 whitespace-pre-wrap">
                  {tranchedPool?.description}
                </Paragraph>

                {tranchedPool?.dataroom ? (
                  <Button
                    as="a"
                    variant="rounded"
                    iconRight="ArrowTopRight"
                    href={tranchedPool.dataroom}
                    target="_blank"
                    rel="noreferrer"
                    size="lg"
                    className="mb-20 block"
                  >
                    Dataroom
                  </Button>
                ) : null}

                <Heading
                  level={4}
                  className="mb-4 font-sans !text-lg !font-semibold"
                >
                  Highlights
                </Heading>
                <ul className="mb-8 list-outside list-disc pl-5">
                  {tranchedPool?.highlights?.map((item, idx) => (
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
                <Heading
                  level={4}
                  className="mb-4 font-sans !text-lg !font-semibold"
                >
                  Recent Activity
                </Heading>
                {tranchedPool ? (
                  <TransactionTable tranchedPoolId={tranchedPool.id} />
                ) : null}
              </TabContent>
              <TabContent>
                {tranchedPool ? (
                  <BorrowerProfile tranchedPool={tranchedPool} />
                ) : null}
              </TabContent>
            </TabPanels>
          </TabGroup>
        </div>
      </div>
    </>
  );
}
