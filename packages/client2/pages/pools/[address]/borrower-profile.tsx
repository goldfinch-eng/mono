import { gql } from "@apollo/client";
import Image from "next/image";

import { Chip, Icon } from "@/components/design-system";
import { BorrowerProfileFieldsFragment } from "@/lib/graphql/generated";

export const BORROWER_PROFILE_FIELDS = gql`
  fragment BorrowerProfileFields on TranchedPool {
    id
    borrower @client {
      name
      logo
      orgType
      website
      linkedIn
      twitter
      bio
      highlights
    }
  }
`;

export function BorrowerProfile({
  tranchedPool: {
    borrower: { name, logo, website, linkedIn, twitter, bio, highlights },
  },
}: {
  tranchedPool: BorrowerProfileFieldsFragment;
}) {
  return (
    <div>
      <div className="mb-8 items-center justify-between lg:flex">
        <div className="mb-3 flex items-center">
          {logo && (
            <div className="relative mr-3 h-8 w-8 overflow-hidden rounded-full border border-sand-200">
              <Image
                src={logo}
                alt={name}
                className="block h-full w-full object-contain object-center"
                layout="fill"
                sizes="32px"
              />
            </div>
          )}

          <h2 className="text-3xl lg:mb-0">{name}</h2>
        </div>
        <div className="flex gap-2">
          <Chip
            className="relative flex items-center sm:gap-2"
            colorScheme="sand"
          >
            <Icon name="Link" size="sm" />
            <a
              className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
              href={website}
              target="_blank"
              rel="noreferrer"
            >
              <span className="sr-only sm:not-sr-only">Website</span>
            </a>
          </Chip>
          <Chip
            className="relative flex items-center sm:gap-2"
            colorScheme="sand"
          >
            <Icon name="LinkedIn" size="sm" />
            <a
              className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
              href={linkedIn}
              target="_blank"
              rel="noreferrer"
            >
              <span className="sr-only sm:not-sr-only">LinkedIn</span>
            </a>
          </Chip>
          {twitter ? (
            <Chip
              className="relative flex items-center sm:gap-2"
              colorScheme="sand"
            >
              <Icon name="Twitter" size="sm" />
              <a
                className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
                href={twitter}
                target="_blank"
                rel="noreferrer"
              >
                <span className="sr-only sm:not-sr-only">Twitter</span>
              </a>
            </Chip>
          ) : null}
        </div>
      </div>
      <div className="mb-20">{bio}</div>
      {highlights ? (
        <>
          <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
          <ul className="list-outside list-disc space-y-5 pl-5">
            {highlights.map((item, idx) => (
              <li
                key={`pool-highlight-${name}-${idx}`}
                className="whitespace-pre-wrap"
              >
                {item}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
