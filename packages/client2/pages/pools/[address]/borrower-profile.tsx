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
      headerColor
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
    borrower: {
      name,
      logo,
      headerColor,
      orgType,
      website,
      linkedIn,
      twitter,
      bio,
      highlights,
    },
  },
}: {
  tranchedPool: BorrowerProfileFieldsFragment;
}) {
  return (
    <div>
      <div
        className="mb-8 flex h-60 items-center justify-center"
        style={{ backgroundColor: headerColor }}
      >
        <div className="relative h-20 w-20 overflow-hidden rounded-full">
          <Image
            src={logo}
            alt={`${name} logo`}
            objectFit="contain"
            layout="fill"
            sizes="80px"
          />
        </div>
      </div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <h2 className="text-3xl">{name}</h2>
          <div className="text-xs font-medium">{orgType}</div>
        </div>
        <div className="flex gap-2">
          <Chip className="relative flex items-center gap-2">
            <Icon name="Link" size="sm" />
            <a
              className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
              href={website}
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
          </Chip>
          <Chip className="relative flex items-center gap-2">
            <Icon name="LinkedIn" size="sm" />
            <a
              className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
              href={linkedIn}
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
          </Chip>
          {twitter ? (
            <Chip className="relative flex items-center gap-2">
              <Icon name="Twitter" size="sm" />
              <a
                className="after:absolute after:top-0 after:left-0 after:h-full after:w-full"
                href={twitter}
                target="_blank"
                rel="noreferrer"
              >
                Twitter
              </a>
            </Chip>
          ) : null}
        </div>
      </div>
      <div className="mb-20">{bio}</div>
      <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
      <ul className="list-outside list-disc pl-5">
        {highlights.map((item, idx) => (
          <li
            key={`pool-highlight-${name}-${idx}`}
            className="whitespace-pre-wrap py-1"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
