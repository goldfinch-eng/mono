// import { gql } from "@apollo/client";
import Image from "next/future/image";

import { Chip, ChipLink } from "@/components/design-system";
import { RichText } from "@/components/rich-text";
import {
  BorrowerProfileFieldsFragment,
  BorrowerOtherPoolFieldsFragment,
} from "@/lib/graphql/generated";
// import { TRANCHED_POOL_REPAYMENT_STATUS_FIELDS } from "@/lib/pools";

// export const BORROWER_OTHER_POOL_FIELDS = gql`
//   ${TRANCHED_POOL_REPAYMENT_STATUS_FIELDS}
//   fragment BorrowerOtherPoolFields on TranchedPool {
//     id
//     name @client
//     creditLine {
//       maxLimit
//       termEndTime
//     }
//     ...TranchedPoolRepaymentStatusFields
//   }
// `;

// export const BORROWER_PROFILE_FIELDS = gql`
//   fragment BorrowerProfileFields on Borrower {
//     id
//     name
//     logo {
//       url
//     }
//     orgType
//     bio
//     website
//     twitter
//     linkedin
//     mediaLinks {
//       url
//       title
//     }
//     deals {
//       id
//       name
//     }
//   }
// `;

interface BorrowerProfileProps {
  borrower: BorrowerProfileFieldsFragment;
  borrowerOtherPools: BorrowerOtherPoolFieldsFragment[];
}

export function BorrowerProfile({ borrower }: BorrowerProfileProps) {
  return (
    <>
      <div className="space-y-5 rounded-xl bg-mustard-100 p-6">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-mustard-50">
              {borrower.logo?.url ? (
                <Image
                  alt={`${borrower.name} logo`}
                  src={borrower.logo.url}
                  quality={100}
                  sizes="40px"
                />
              ) : null}
            </div>
            <div>
              <div className="font-medium">{borrower.name}</div>
              <div className="text-xs text-sand-500">{borrower.orgType}</div>
            </div>
          </div>
          <Chip
            iconLeft="Checkmark"
            colorScheme="mint"
            className="flex items-center gap-2"
          >
            Experienced borrower
          </Chip>
        </div>
        <RichText content={borrower.bio} />
        <div className="flex flex-wrap gap-2">
          {borrower.website ? (
            <ChipLink
              iconLeft="Link"
              href={borrower.website}
              target="_blank"
              rel="noopener"
            >
              Website
            </ChipLink>
          ) : null}
          {borrower.linkedin ? (
            <ChipLink
              iconLeft="LinkedIn"
              href={borrower.linkedin}
              target="_blank"
              rel="noopener"
            >
              LinkedIn
            </ChipLink>
          ) : null}
          {borrower.twitter ? (
            <ChipLink
              iconLeft="Twitter"
              href={borrower.twitter}
              target="_blank"
              rel="noopener"
            >
              Twitter
            </ChipLink>
          ) : null}
        </div>
      </div>
    </>
  );
}
