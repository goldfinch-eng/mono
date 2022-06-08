import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import {
  Banner,
  Breadcrumb,
  Heading,
  HelperText,
  TabGroup,
  TabList,
  TabButton,
  TabPanels,
  TabContent,
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
import {
  SeniorPoolWithDrawalPanel,
  SENIOR_POOL_WITHDRAWAL_PANEL_POSITION_FIELDS,
} from "./senior-pool-withdrawal-panel";
import { StatusSection, SENIOR_POOL_STATUS_FIELDS } from "./status-section";

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
    (data?.viewer.fiduBalance?.amount.gt(BigNumber.from(0)) ||
      user?.seniorPoolStakedPositions?.length !== 0) &&
    seniorPool?.latestPoolStatus.sharePrice;
  return (
    <>
      <BannerPortal>
        <Banner
          initialContent="This offering is only available to non-U.S. persons"
          expandedContent="This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."
        />
      </BannerPortal>

      <div className="pool-layout">
        <div style={{ gridArea: "heading" }}>
          <div className="mb-6 flex justify-center lg:justify-start">
            <Breadcrumb label="Goldfinch" image={goldfinchYellow.src} />
          </div>
          <Heading className="text-center lg:text-left" level={1}>
            Senior Pool
          </Heading>
        </div>
        <div className="relative" style={{ gridArea: "widgets" }}>
          <div className="flex flex-col items-stretch gap-8 lg:sticky lg:top-12">
            {data && shouldShowWithdrawal && (
              <SeniorPoolWithDrawalPanel
                fiduBalance={data.viewer.fiduBalance ?? undefined}
                seniorPoolSharePrice={seniorPool.latestPoolStatus.sharePrice}
                stakedPositions={user?.seniorPoolStakedPositions}
                seniorPoolLiquidity={seniorPool.latestPoolStatus.usdcBalance}
              />
            )}

            {seniorPool && fiatPerGfi ? (
              <SeniorPoolSupplyPanel
                seniorPool={seniorPool}
                user={user}
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
          {seniorPool ? <StatusSection seniorPool={seniorPool} /> : null}
          <div className="mb-8 mt-14">
            <TabGroup>
              <TabList>
                <TabButton>Overview</TabButton>
                <TabButton>How it works</TabButton>
              </TabList>
              <TabPanels>
                <TabContent>
                  <h2 className="mb-8 text-3xl">Overview</h2>
                  <p className="mb-8 text-2xl font-light">
                    The Senior Pool is the simple, lower risk, lower return
                    option on Goldfinch. Capital is automatically diversified
                    across Borrower pools, and protected by Backer capital.
                  </p>
                  <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
                  <ul className="mb-8 list-outside list-disc pl-5 text-lg">
                    <li>
                      Earn passive yield. Capital is automatically deployed
                      across a diverse portfolio of Borrowers that are vetted by
                      Backers.
                    </li>
                    <li>
                      Lower risk. Losses are protected by the first-loss capital
                      supplied by Backers.
                    </li>
                    <li>
                      Stable returns. Receive USDC APY from the underlying
                      interest, driven by real-world activity that is
                      uncorrelated with crypto, plus GFI from liquidity mining
                      distributions.
                    </li>
                  </ul>
                  <RecentRepaymentsTable />
                </TabContent>
                <TabContent>
                  <h2 className="mb-8 text-3xl">How It Works</h2>
                  <p>
                    Liquidity Providers supply capital to the Senior Pool in
                    order to earn passive yield. The Senior Pool automatically
                    allocates their capital to the senior tranches of Borrower
                    Pools.
                  </p>
                  <h3 className="my-8 text-lg font-semibold">
                    Supplying to the Senior Pool
                  </h3>
                  <p className="mb-2">
                    Liquidity Providers supply capital to the Senior Pool in
                    order to earn passive yield. The Senior Pool then
                    automatically allocates that capital across the senior
                    tranches of Borrower Pools according to the Leverage Model.
                    The Senior Pool thereby provides both diversification across
                    Borrower Pools and seniority to the first-loss capital of
                    Backers. This process does not involve seeking the
                    permission of different Borrowers.
                  </p>
                  <p>
                    To compensate Backers for both evaluating Borrowers Pools
                    and providing first-loss capital, 20% of the Senior
                    Pool&apos;s nominal interest is reallocated to Backers.
                  </p>
                  <h3 className="my-8 text-lg font-semibold">FIDU</h3>
                  <p className="mb-2">
                    When Liquidity Providers supply to the Senior Pool, they
                    receive an equivalent amount of FIDU. FIDU is an ERC20
                    token. At any time, Liquidity Providers can withdraw by
                    redeeming their FIDU for USDC at an exchange rate based on
                    the net asset value of the Senior Pool, minus a 0.5%
                    withdrawal fee. This exchange rate for FIDU increases over
                    time as interest payments are made back to the Senior Pool.
                  </p>
                  <p>
                    It is possible that when a Liquidity Provider wants to
                    withdraw, the Senior Pool may not have sufficient USDC
                    because it has been borrowed by Borrowers. In this event,
                    the Liquidity Provider may return when new capital enters
                    the Senior Pool through Borrower repayments or new Liquidity
                    Providers.
                  </p>
                  <h3 className="my-8 text-lg font-semibold">
                    Summary of Liquidity Provider Incentives
                  </h3>
                  <p>
                    Liquidity providers are incentivized to supply to the Senior
                    Pool in order to earn passive yield.
                  </p>
                </TabContent>
              </TabPanels>
            </TabGroup>
          </div>
        </div>
      </div>
    </>
  );
}
