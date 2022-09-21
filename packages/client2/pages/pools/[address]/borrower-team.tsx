import { gql } from "@apollo/client";
import Image from "next/image";

import { ChipLink } from "@/components/design-system";
import { CDN_URL } from "@/constants";
import { CmsTeamMemberFieldsFragment } from "@/lib/graphql/generated";

export const CMS_TEAM_MEMBER_FIELDS = gql`
  fragment CMSTeamMemberFields on TeamMember {
    id
    name
    position
    linkedin
    image {
      url
      sizes {
        portrait {
          url
        }
      }
    }
  }
`;

interface BorrowerTeamProps {
  description?: string | null;
  members?: CmsTeamMemberFieldsFragment[] | null;
}

export function BorrowerTeam({ description, members }: BorrowerTeamProps) {
  return (
    <div>
      <h3 className="mb-8 text-lg font-semibold">Team</h3>
      {description ? <p className="mb-8">{description}</p> : null}

      {members ? (
        <div className="flex w-full flex-wrap gap-4">
          {members.map((member) => {
            const image = member.image?.sizes?.portrait?.url
              ? `${CDN_URL}${member.image?.sizes?.portrait?.url}`
              : member.image?.url
              ? `${CDN_URL}${member.image?.url}`
              : null;

            // Only add card if name exists
            return member.name ? (
              <div key={`team-member-${member.id}`} className="flex-1">
                <EmployeeCard
                  name={member.name}
                  image={image}
                  position={member.position}
                  linkedin={member.linkedin}
                />
              </div>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

interface EmployeeCardProps {
  image?: string | null;
  name: string;
  position?: string | null;
  linkedin?: string | null;
}

function EmployeeCard({ image, name, position, linkedin }: EmployeeCardProps) {
  return (
    <div className="h-full rounded-lg border border-sand-200 p-5">
      <div className="flex gap-5">
        {image ? (
          <div className="w-2/5">
            <Image
              src={image}
              alt={name}
              layout="responsive"
              width={160}
              height={180}
              objectFit="cover"
              className="w-full"
            />
          </div>
        ) : null}
        <div className="flex flex-col items-start justify-between whitespace-pre-wrap break-words">
          <div>
            <h5 className="mb-2 font-medium">{name}</h5>
            {position ? <p className="mb-0">{position}</p> : null}
          </div>
          {linkedin ? (
            <ChipLink
              iconLeft="LinkedIn"
              href={linkedin}
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </ChipLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
