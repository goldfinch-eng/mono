import { gql } from "@apollo/client";
import Image from "next/image";

import { ChipLink } from "@/components/design-system";
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

      {members && members.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {members.map((member) => {
            const image =
              member.image?.sizes?.portrait?.url ?? member.image?.url;

            // Only add card if name exists
            return member.name ? (
              <EmployeeCard
                key={`team-member-${member.id}`}
                name={member.name}
                image={image}
                position={member.position}
                linkedin={member.linkedin}
              />
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
    <div className="flex gap-5 rounded-lg border border-sand-200 p-5">
      {image ? (
        <Image
          src={image}
          alt={name}
          width={160}
          height={180}
          objectFit="cover"
        />
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
  );
}
