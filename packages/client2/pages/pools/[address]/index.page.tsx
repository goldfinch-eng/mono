import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useRouter } from "next/router";

import {
  Breadcrumb,
  Button,
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
  Heading,
  ShimmerLines,
  HelperText,
  Marquee,
  Banner,
} from "@/components/design-system";
import { BannerPortal, SubnavPortal } from "@/components/layout";
import { SEO } from "@/components/seo";
import {
  SupportedCrypto,
  UidType,
  useSingleTranchedPoolDataQuery,
} from "@/lib/graphql/generated";
import {
  PoolStatus,
  getTranchedPoolStatus,
  TRANCHED_POOL_STATUS_FIELDS,
} from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { BorrowerProfile, BORROWER_PROFILE_FIELDS } from "./borrower-profile";
import ComingSoonPanel from "./coming-soon-panel";
import DealTermsTable from "./deal-terms-table";
import FundingBar from "./funding-bar";
import RepaymentProgressPanel from "./repayment-progress-panel";
import {
  StatusSection,
  TRANCHED_POOL_STAT_GRID_FIELDS,
} from "./status-section";
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
  ${TRANCHED_POOL_STAT_GRID_FIELDS}
  ${SUPPLY_PANEL_TRANCHED_POOL_FIELDS}
  ${SUPPLY_PANEL_USER_FIELDS}
  ${WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS}
  ${WITHDRAWAL_PANEL_ZAP_FIELDS}
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
        id
        isLate @client
        termInDays
        paymentPeriodInDays
        nextDueTime
        interestAprDecimal
        borrower
        lateFeeApr
      }
      initialInterestOwed
      principalAmountRepaid
      interestAmountRepaid
      ...TranchedPoolStatusFields
      ...SupplyPanelTranchedPoolFields
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
      tranchedPoolTokens(where: { tranchedPool: $tranchedPoolAddress }) {
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
    backerSupply && tranchedPool?.estimatedLeverageRatio
      ? {
          token: SupportedCrypto.Usdc,
          amount: backerSupply.amount.mul(tranchedPool.estimatedLeverageRatio),
        }
      : undefined;

  // Spec for this logic: https://linear.app/goldfinch/issue/GFI-638/as-unverified-user-we-display-this-pool-is-only-for-non-us-persons
  let initialBannerContent = "";
  let expandedBannerContent = "";
  const poolSupportsUs =
    tranchedPool?.allowedUidTypes.includes(UidType.UsAccreditedIndividual) ||
    tranchedPool?.allowedUidTypes.includes(UidType.UsEntity);
  const noUid =
    !user?.isNonUsEntity &&
    !user?.isNonUsIndividual &&
    !user?.isUsAccreditedIndividual &&
    !user?.isUsEntity &&
    !user?.isUsNonAccreditedIndividual;
  const uidIsUs =
    user?.isUsAccreditedIndividual ||
    user?.isUsEntity ||
    user?.isUsNonAccreditedIndividual;
  const uidIsNonUs = user?.isNonUsEntity || user?.isNonUsIndividual;
  if (poolSupportsUs && noUid) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons or U.S. accredited investors.";
    expandedBannerContent =
      "Eligibility to participate in this offering is determined by your (i) investor accreditation status and (ii) your residency. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, and may not be offered or sold to a U.S. person that is not an accredited investor, absent registration or an applicable exemption from the registration requirements. Log in with your address and claim your UID to see if you're eligible to participate.";
  } else if (poolSupportsUs && uidIsUs) {
    initialBannerContent =
      "This offering is only available to U.S. accredited investors.";
    expandedBannerContent =
      "This offering is only available to U.S. accredited investors. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom.";
  } else if (poolSupportsUs && uidIsNonUs) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons.";
    expandedBannerContent =
      "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements.";
  } else if (!poolSupportsUs) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons.";
    expandedBannerContent =
      "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements.";
  }

  return (
    <>
      <SEO title={tranchedPool?.name} />

      {initialBannerContent && expandedBannerContent ? (
        <BannerPortal>
          <Banner
            initialContent={initialBannerContent}
            expandedContent={expandedBannerContent}
          />
        </BannerPortal>
      ) : null}

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
                ? "green"
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
          {/* gives the illusion of rounded corners on the top of the page */}
          <div className="-mt-3 h-3 rounded-t-xl bg-white" />
        </SubnavPortal>
      )}

      <div className="pool-layout">
        <div style={{ gridArea: "heading" }}>
          <div className="mb-8 flex flex-wrap justify-between gap-2">
            <div>
              <Breadcrumb
                label={tranchedPool?.name}
                image={tranchedPool?.icon}
              />
            </div>
            {tranchedPool && poolStatus !== PoolStatus.ComingSoon ? (
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
            className="mb-12 text-center text-sand-800 md:text-left"
          >
            {tranchedPool ? (
              tranchedPool.name
            ) : (
              <ShimmerLines truncateFirstLine={false} lines={2} />
            )}
          </Heading>

          {error ? (
            <HelperText isError>
              There was a problem fetching data on this pool. Shown data may be
              outdated.
            </HelperText>
          ) : null}

          {poolStatus === PoolStatus.Open ? (
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
          ) : null}

          {poolStatus && tranchedPool && seniorPool && fiatPerGfi ? (
            <StatusSection
              className="mt-12"
              poolStatus={poolStatus}
              tranchedPool={tranchedPool}
              seniorPoolApyFromGfiRaw={
                seniorPool.latestPoolStatus.estimatedApyFromGfiRaw
              }
              fiatPerGfi={fiatPerGfi}
            />
          ) : null}
        </div>

        <div className="relative" style={{ gridArea: "widgets" }}>
          {tranchedPool && seniorPool && fiatPerGfi ? (
            <div className="flex flex-col items-stretch gap-8">
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

              {data?.user &&
              (data?.user.tranchedPoolTokens.length > 0 ||
                data?.user.zaps.length > 0) ? (
                <WithdrawalPanel
                  tranchedPoolAddress={tranchedPool.id}
                  poolTokens={data.user.tranchedPoolTokens}
                  zaps={data.user.zaps}
                  isPoolLocked={
                    !tranchedPool.juniorTranches[0].lockedUntil.isZero() &&
                    BigNumber.from(data?.currentBlock?.timestamp ?? 0).gt(
                      tranchedPool.juniorTranches[0].lockedUntil
                    )
                  }
                />
              ) : null}

              {tranchedPool &&
              (poolStatus === PoolStatus.Full ||
                poolStatus === PoolStatus.Repaid) ? (
                <RepaymentProgressPanel
                  poolStatus={poolStatus}
                  tranchedPool={tranchedPool}
                  userPoolTokens={user?.tranchedPoolTokens ?? []}
                />
              ) : null}

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
                <div className="mb-20">
                  <h2 className="mb-8 text-3xl">Deal Overview</h2>
                  {tranchedPool ? (
                    <p className="mb-8 whitespace-pre-wrap text-2xl font-light">
                      {tranchedPool.description}
                    </p>
                  ) : (
                    <ShimmerLines lines={3} />
                  )}
                  {tranchedPool?.dataroom ? (
                    <Button
                      as="a"
                      variant="rounded"
                      iconRight="ArrowTopRight"
                      href={tranchedPool.dataroom}
                      target="_blank"
                      rel="noreferrer"
                      size="lg"
                      className="block"
                    >
                      Dataroom
                    </Button>
                  ) : null}
                </div>

                <div className="mb-20">
                  <h2 className="mb-8 text-lg font-semibold">
                    Recent Activity
                  </h2>
                  {tranchedPool ? (
                    <TransactionTable tranchedPoolId={tranchedPool.id} />
                  ) : null}
                </div>

                {tranchedPool?.highlights ? (
                  <div className="mb-20">
                    <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
                    <ul className="list-outside list-disc space-y-5 pl-5">
                      {tranchedPool?.highlights?.map((item, idx) => (
                        <li key={`pool-highlight-${address}-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <DealTermsTable
                  tranchedPool={tranchedPool}
                  poolStatus={poolStatus}
                />
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
