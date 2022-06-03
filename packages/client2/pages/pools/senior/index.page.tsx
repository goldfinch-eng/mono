import { gql } from "@apollo/client";

import {
  Banner,
  Breadcrumb,
  Button,
  Heading,
  HelperText,
} from "@/components/design-system";
import { BannerPortal } from "@/components/layout";
import { useSeniorPoolPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import goldfinchYellow from "./goldfinch-yellow.png";
import { RecentRepaymentsTable } from "./recent-repayments-table";
import {
  SeniorPoolSupplyPanel,
  SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS,
  SENIOR_POOL_SUPPLY_PANEL_USER_FIELDS,
} from "./senior-pool-supply-panel";
import { StatusSection, SENIOR_POOL_STATUS_FIELDS } from "./status-section";

gql`
  ${SENIOR_POOL_STATUS_FIELDS}

  ${SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS}
  ${SENIOR_POOL_SUPPLY_PANEL_USER_FIELDS}
  query SeniorPoolPage($userId: ID!) {
    user(id: $userId) {
      id
      ...SeniorPoolSupplyPanelUserFields
    }
    seniorPools(first: 1) {
      id
      ...SeniorPoolStatusFields
      ...SeniorPoolSupplyPanelPoolFields
    }
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
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

  return (
    <>
      <BannerPortal>
        <Banner
          initialContent="This offering is only available to non-U.S. persons"
          expandedContent="This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."
        />
      </BannerPortal>
      <div className="mb-6 flex justify-center lg:justify-start">
        <Breadcrumb label="Goldfinch" image={goldfinchYellow.src} />
      </div>
      <Heading className="mb-12 text-center lg:text-left" level={1}>
        Senior Pool
      </Heading>
      <div className="flex flex-col items-stretch gap-10 xl:grid xl:grid-cols-12">
        <div className="xl:relative xl:col-start-9 xl:col-end-13">
          <div className="flex flex-col items-stretch gap-8 xl:sticky xl:top-12">
            {seniorPool && fiatPerGfi ? (
              <SeniorPoolSupplyPanel
                seniorPool={seniorPool}
                user={user}
                fiatPerGfi={fiatPerGfi}
              />
            ) : null}
          </div>
        </div>
        <div className="xl:col-start-1 xl:col-end-9 xl:row-start-1">
          {error ? (
            <HelperText isError>
              There was a problem fetching data on the senior pool. Shown data
              may be outdated.
            </HelperText>
          ) : null}
          {seniorPool ? <StatusSection seniorPool={seniorPool} /> : null}
          <div className="mb-8 mt-14">
            <h2 className="mb-8 text-3xl">Overview</h2>
            <p className="mb-8 text-2xl font-light">
              The Senior Pool is the simple, lower risk, lower return option on
              Goldfinch. Capital is automatically diversified across Borrower
              pools, and protected by Backer capital.
            </p>
            <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
            <ul className="mb-8 list-outside list-disc pl-5 text-lg">
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
            <Button
              as="a"
              iconRight="ArrowTopRight"
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics"
              target="_blank"
              rel="noopener"
              size="lg"
              variant="rounded"
            >
              How it works
            </Button>
          </div>
          <RecentRepaymentsTable />
        </div>
      </div>
    </>
  );
}
