import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import {
  Banner,
  Breadcrumb,
  Heading,
  HelperText,
  Button,
  goldfinchLogoWhiteBgPngUrl,
} from "@/components/design-system";
import { BannerPortal } from "@/components/layout";
import { useSeniorPoolPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import {
  SeniorPoolSupplyPanel,
  SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS,
  SENIOR_POOL_SUPPLY_PANEL_USER_FIELDS,
} from "./senior-pool-supply-panel";
import {
  SeniorPoolWithDrawalPanel,
  SENIOR_POOL_WITHDRAWAL_PANEL_POSITION_FIELDS,
} from "./senior-pool-withdrawal-panel";
import { StatusSection, SENIOR_POOL_STATUS_FIELDS } from "./status-section";
import { TransactionTable } from "./transaction-table";
import { UnstakedFiduBanner } from "./unstaked-fidu-panel";

gql`
  ${SENIOR_POOL_STATUS_FIELDS}

  ${SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS}
  ${SENIOR_POOL_SUPPLY_PANEL_USER_FIELDS}

  ${SENIOR_POOL_WITHDRAWAL_PANEL_POSITION_FIELDS}
  query SeniorPoolPage($userId: ID!) {
    user(id: $userId) {
      id
      ...SeniorPoolSupplyPanelUserFields
      seniorPoolStakedPositions {
        ...SeniorPoolWithdrawalPanelPositionFields
      }
    }
    seniorPools(first: 1) {
      id
      latestPoolStatus {
        id
        sharePrice
        usdcBalance
      }
      ...SeniorPoolStatusFields
      ...SeniorPoolSupplyPanelPoolFields
    }
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
      }
    }
    viewer @client {
      fiduBalance {
        token
        amount
      }
    }
  }
`;

export default function SeniorPoolPage() {
  const { account } = useWallet();
  const { data, error } = useSeniorPoolPageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
  });

  const seniorPool = data?.seniorPools[0];
  const user = data?.user ?? null;
  const fiatPerGfi = data?.gfiPrice?.price.amount;
  const shouldShowWithdrawal =
    account &&
    seniorPool?.latestPoolStatus.sharePrice &&
    (data?.viewer.fiduBalance?.amount.gt(BigNumber.from(0)) ||
      (user &&
        user.seniorPoolStakedPositions.length > 0 &&
        user.seniorPoolStakedPositions.some((s) => s.amount.gt(0))));

  // Spec for this logic: https://linear.app/goldfinch/issue/GFI-638/as-unverified-user-we-display-this-pool-is-only-for-non-us-persons
  let initialBannerContent = "";
  let expandedBannerContent = "";
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
  if (noUid) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons or U.S. accredited investors.";
    expandedBannerContent =
      "Eligibility to participate in this offering is determined by your (i) investor accreditation status and (ii) your residency. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, and may not be offered or sold to a U.S. person that is not an accredited investor, absent registration or an applicable exemption from the registration requirements. Log in with your address and claim your UID to see if you're eligible to participate.";
  } else if (uidIsUs) {
    initialBannerContent =
      "This offering is only available to U.S. accredited investors.";
    expandedBannerContent =
      "This offering is only available to U.S. accredited investors. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom.";
  } else if (uidIsNonUs) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons.";
    expandedBannerContent =
      "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements.";
  }

  return (
    <>
      {initialBannerContent && expandedBannerContent ? (
        <BannerPortal>
          <Banner
            initialContent={initialBannerContent}
            expandedContent={expandedBannerContent}
          />
          {/* gives the illusion of rounded corners on the page */}
          <div className="bg-sky-500">
            <div className="h-3 rounded-t-xl bg-white" />
          </div>
        </BannerPortal>
      ) : null}

      <div className="pool-layout">
        <div style={{ gridArea: "heading" }}>
          <div className="mb-8 flex flex-wrap justify-between gap-2">
            <Breadcrumb label="Goldfinch" image={goldfinchLogoWhiteBgPngUrl} />
            {seniorPool ? (
              <Button
                variant="rounded"
                colorScheme="secondary"
                iconRight="ArrowTopRight"
                as="a"
                href={`https://etherscan.io/address/${seniorPool.id}`}
                target="_blank"
                rel="noopener"
              >
                Contract
              </Button>
            ) : null}
          </div>
          <Heading className="text-center lg:text-left" level={1}>
            Goldfinch Senior Pool
          </Heading>
        </div>
        <div className="relative" style={{ gridArea: "widgets" }}>
          <div className="flex flex-col items-stretch gap-8">
            {seniorPool && fiatPerGfi && data?.viewer ? (
              <SeniorPoolSupplyPanel
                seniorPool={seniorPool}
                user={user}
                fiatPerGfi={fiatPerGfi}
              />
            ) : null}

            {data && shouldShowWithdrawal && (
              <SeniorPoolWithDrawalPanel
                fiduBalance={data.viewer.fiduBalance ?? undefined}
                seniorPoolSharePrice={seniorPool.latestPoolStatus.sharePrice}
                stakedPositions={user?.seniorPoolStakedPositions}
                seniorPoolLiquidity={seniorPool.latestPoolStatus.usdcBalance}
              />
            )}

            {data?.viewer.fiduBalance?.amount.gt(0) &&
            seniorPool &&
            fiatPerGfi ? (
              <UnstakedFiduBanner
                fiduBalance={data.viewer.fiduBalance}
                sharePrice={seniorPool?.latestPoolStatus.sharePrice}
                estimatedApyFromGfiRaw={
                  seniorPool?.latestPoolStatus.estimatedApy
                }
                fiatPerGfi={fiatPerGfi}
              />
            ) : null}
          </div>
        </div>
        <div style={{ gridArea: "info" }}>
          {error ? (
            <HelperText isError>
              There was a problem fetching data on the senior pool. Shown data
              may be outdated.
            </HelperText>
          ) : null}
          {seniorPool ? (
            <StatusSection className="mb-12" seniorPool={seniorPool} />
          ) : null}
          <div className="mb-20">
            <h2 className="mb-8 text-3xl">Overview</h2>
            <p className="mb-8 text-2xl font-light">
              The Senior Pool is the simple, lower risk, lower return option on
              Goldfinch. Capital is automatically diversified across Borrower
              pools, and protected by Backer capital.
            </p>
            <Button
              className="block"
              as="a"
              size="lg"
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/liquidityproviders"
              iconRight="ArrowTopRight"
              variant="rounded"
            >
              How it Works
            </Button>
          </div>

          <TransactionTable />
          <div className="flex gap-2">
            <Button
              as="a"
              href="https://dune.com/goldfinch/goldfinch"
              colorScheme="secondary"
              iconRight="ArrowTopRight"
              variant="rounded"
            >
              Dashboard
            </Button>
            <Button
              as="a"
              href={`https://etherscan.io/address/${seniorPool?.id}`}
              colorScheme="secondary"
              iconRight="ArrowTopRight"
              variant="rounded"
            >
              Pool
            </Button>
          </div>

          <div className="mt-20">
            <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
            <ul className="list-outside list-disc space-y-5 pl-5">
              <li>
                Earn passive yield. Capital is automatically deployed across a
                diverse portfolio of Borrowers that are vetted by Backers.
              </li>
              <li>
                Lower risk. Losses are protected by the first-loss capital
                supplied by Backers.
              </li>
              <li>
                Stable returns. Receive USDC APY from the underlying interest,
                driven by real-world activity that is uncorrelated with crypto,
                plus GFI from liquidity mining distributions.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
