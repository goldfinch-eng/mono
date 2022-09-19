import { gql } from "@apollo/client";
import Image from "next/image";

import { Chip, Icon } from "@/components/design-system";
import { CDN_URL } from "@/constants";
import {
  BorrowerProfileFieldsFragment,
  BorrowerOtherPoolFieldsFragment,
} from "@/lib/graphql/generated";

import { BorrowerTeam } from "./borrower-team";
import {
  BorrowerFinancialsTable,
  UnderwritingPerformanceTable,
} from "./deal-tables";
import { DocumentsList } from "./documents-list";

export const BORROWER_OTHER_POOL_FIELDS = gql`
  fragment BorrowerOtherPoolFields on TranchedPool {
    id
    principalAmountRepaid
    creditLine {
      id
      maxLimit
    }
  }
`;

export const BORROWER_PROFILE_FIELDS = gql`
  fragment BorrowerProfileFields on Borrower {
    id
    name
    logo {
      url
      sizes {
        thumbnail {
          url
        }
      }
    }
    subheading
    bio
    market
    history
    website
    twitter
    linkedin
    incorporatedCountry
    operatingCountry
    highlights {
      text
    }
    underwritingPerformance {
      ...BorrowerPerformanceTableFields
    }
    borrowerFinancials {
      ...BorrowerFinancialsTableFields
    }
    team {
      description
      members {
        ...CMSTeamMemberFields
      }
    }
    mediaLinks {
      url
      title
    }
    contactInfo {
      email
      description
    }
    documents {
      ...DocumentFields
    }
    deals {
      id
      name
    }
  }
`;

interface BorrowerProfileProps {
  poolId?: string | null;
  borrower: BorrowerProfileFieldsFragment;
  borrowerPools?: BorrowerOtherPoolFieldsFragment[];
}

export function BorrowerProfile({
  poolId,
  borrower,
  borrowerPools,
}: BorrowerProfileProps) {
  // Combine CMS and on chain data
  const allDeals = (borrower.deals || []).map((deal) => ({
    id: deal.id,
    name: deal.name,
    pool: {
      ...borrowerPools?.find((pool) => deal.id === pool.id),
    } as BorrowerOtherPoolFieldsFragment,
  }));

  return (
    <div>
      <div className="mb-20">
        <div className="mb-8 items-center justify-between lg:flex">
          <div className="mb-3 flex items-center">
            {borrower.logo && (
              <div className="relative mr-3 h-8 w-8 overflow-hidden rounded-full border border-sand-200">
                <Image
                  src={`${CDN_URL}${
                    borrower.logo?.sizes?.thumbnail?.url ?? borrower.logo?.url
                  }`}
                  alt={borrower.name}
                  className="block h-full w-full object-contain object-center"
                  layout="fill"
                  sizes="32px"
                />
              </div>
            )}

            <h2 className="text-3xl lg:mb-0">{borrower.name}</h2>
          </div>
          <div className="flex gap-2">
            {borrower.website ? (
              <Chip
                className="relative flex items-center sm:gap-2"
                colorScheme="sand"
              >
                <Icon name="Link" size="sm" />
                <a
                  className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
                  href={borrower.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="sr-only sm:not-sr-only">Website</span>
                </a>
              </Chip>
            ) : null}
            {borrower.linkedin ? (
              <Chip
                className="relative flex items-center sm:gap-2"
                colorScheme="sand"
              >
                <Icon name="LinkedIn" size="sm" />
                <a
                  className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
                  href={borrower.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="sr-only sm:not-sr-only">LinkedIn</span>
                </a>
              </Chip>
            ) : null}
            {borrower.twitter ? (
              <Chip
                className="relative flex items-center sm:gap-2"
                colorScheme="sand"
              >
                <Icon name="Twitter" size="sm" />
                <a
                  className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
                  href={borrower.twitter}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="sr-only sm:not-sr-only">Twitter</span>
                </a>
              </Chip>
            ) : null}
          </div>
        </div>

        {borrower.subheading ? (
          <p className="mb-8 whitespace-pre-wrap text-2xl font-light">
            {borrower.subheading}
          </p>
        ) : null}

        {borrower.bio ? <div className="mb-8">{borrower.bio}</div> : null}

        {borrower.history ? (
          <div className="mb-8">
            <h3 className="mb-5 font-semibold">History</h3>
            <p>{borrower.history}</p>
          </div>
        ) : null}

        {borrower.market ? (
          <div className="mb-8">
            <h3 className="mb-5 font-semibold">Market</h3>
            <p>{borrower.market}</p>
          </div>
        ) : null}

        <div className="mb-8">
          {borrower.operatingCountry ? (
            <p>Operating in {borrower.operatingCountry}</p>
          ) : null}

          {borrower.incorporatedCountry ? (
            <p>Incorporated in {borrower.incorporatedCountry}</p>
          ) : null}
        </div>
      </div>

      {borrower.highlights ? (
        <div className="mb-20">
          <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
          <ul className="list-outside list-disc space-y-5 pl-5">
            {borrower.highlights.map((item, idx) => (
              <li key={`borrower-highlight-${borrower?.id}-${idx}`}>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-20">
        <BorrowerFinancialsTable
          currentPool={poolId}
          allDeals={allDeals}
          borrowerFinancials={borrower.borrowerFinancials}
        />
      </div>

      <div className="mb-20">
        <UnderwritingPerformanceTable
          details={borrower.underwritingPerformance}
        />
      </div>

      {borrower.team &&
      (borrower.team.members || borrower.team?.description) ? (
        <div className="mb-20">
          <BorrowerTeam
            members={borrower.team.members}
            description={borrower.team.description}
          />
        </div>
      ) : null}

      {borrower.mediaLinks ? (
        <div className="mb-20">
          <h3 className="mb-8 text-lg font-semibold">Media</h3>
          <ul>
            {borrower.mediaLinks.map((link, idx) => (
              <li
                key={`borrower-media-link-${link.url}-${idx}`}
                className="py-1"
              >
                <a
                  href={link.url ?? ""}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-eggplant-700 underline sm:gap-2"
                >
                  {link.title}
                  <Icon name="ArrowTopRight" size="sm" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {borrower.contactInfo ? (
        <div className="mb-20">
          <h3 className="mb-8 text-lg font-semibold">Contact Information</h3>
          {borrower.contactInfo.description ? (
            <p>{borrower.contactInfo.description}</p>
          ) : null}
          {borrower.contactInfo.email ? (
            <a
              href={`mailto:${borrower.contactInfo.email}`}
              className="text-eggplant-700 underline"
            >
              {borrower.contactInfo.email}
            </a>
          ) : null}
        </div>
      ) : null}

      {borrower.documents ? (
        <DocumentsList documents={borrower.documents} />
      ) : null}
    </div>
  );
}
