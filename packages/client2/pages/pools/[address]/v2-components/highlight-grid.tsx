import { gql } from "@apollo/client";
import clsx from "clsx";

import { RichText } from "@/components/rich-text";
import { HighlightGridFieldsFragment } from "@/lib/graphql/generated";

export const HIGHLIGHT_GRID_FIELDS = gql`
  fragment HighlightGridFields on Deal_Highlights {
    heading
    body
  }
`;

interface HighlightGridProps {
  highlights: HighlightGridFieldsFragment[];
}

export function HighlightGrid({ highlights }: HighlightGridProps) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {highlights.map((highlight, index) => (
        <div
          key={highlight.heading}
          className={clsx(
            "flex justify-between rounded-lg p-6",
            index === 0
              ? "col-span-full flex-row gap-12 bg-sand-800"
              : "flex-col gap-4 bg-sand-700"
          )}
        >
          <div
            className={clsx(
              "font-serif font-semibold text-mustard-200",
              index === 0 ? "basis-1/2 text-2xl" : "text-xl"
            )}
          >
            {highlight.heading}
          </div>
          <RichText
            className="text-sm text-mustard-50"
            content={highlight.body}
          />
        </div>
      ))}
    </div>
  );
}
