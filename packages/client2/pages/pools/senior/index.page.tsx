import { gql } from "@apollo/client";

import {
  Banner,
  Breadcrumb,
  Heading,
  HelperText,
} from "@/components/design-system";
import { BannerPortal } from "@/components/layout";
import { useSeniorPoolPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import goldfinchYellow from "./goldfinch-yellow.png";
import {
  PortfolioSection,
  SENIOR_POOL_PORTFOLIO_USER_FIELDS,
  SENIOR_POOL_PORTFOLIO_POOL_FIELDS,
} from "./portfolio-section";
import { StatusSection, SENIOR_POOL_STATUS_FIELDS } from "./status-section";

gql`
  ${SENIOR_POOL_PORTFOLIO_USER_FIELDS}
  ${SENIOR_POOL_PORTFOLIO_POOL_FIELDS}

  ${SENIOR_POOL_STATUS_FIELDS}
  query SeniorPoolPage($userId: ID!) {
    user(id: $userId) {
      id
      ...SeniorPoolPortfolioUserFields
    }
    seniorPools(first: 1) {
      id
      ...SeniorPoolPortfolioPoolFields
      ...SeniorPoolStatusFields
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
            <div>panel1</div>
            <div>panel2</div>
          </div>
        </div>
        <div className="xl:col-start-1 xl:col-end-9 xl:row-start-1">
          {error ? (
            <HelperText isError>
              There was a problem fetching data on the senior pool. Shown data
              may be outdated.
            </HelperText>
          ) : null}
          <PortfolioSection user={data?.user} seniorPool={seniorPool} />
          <StatusSection seniorPool={seniorPool} />
        </div>
      </div>
    </>
  );
}
