import { gql } from "@apollo/client";

import { HighlightGrid, Highlight } from "@/components/design-system";
import { RichText } from "@/components/rich-text";
import { DealHighlightFieldsFragment } from "@/lib/graphql/generated";

export const DEAL_HIGHLIGHT_FIELDS = gql`
  fragment DealHighlightFields on Deal_Highlights {
    heading
    body
  }
`;

interface HighlightGridProps {
  highlights: DealHighlightFieldsFragment[];
}

export function DealHighlights({ highlights }: HighlightGridProps) {
  return (
    <HighlightGrid>
      {highlights.map((highlight) => (
        <Highlight
          key={highlight.heading}
          heading={highlight.heading as string}
          body={<RichText content={highlight.body} />}
        />
      ))}
    </HighlightGrid>
  );
}
