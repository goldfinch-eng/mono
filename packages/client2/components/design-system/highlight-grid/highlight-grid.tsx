import { gql } from "@apollo/client";
import clsx from "clsx";
import { ReactNode } from "react";

export const HIGHLIGHT_GRID_FIELDS = gql`
  fragment HighlightGridFields on Deal_Highlights {
    heading
    body
  }
`;

interface HighlightGridProps {
  children: ReactNode;
}

export function HighlightGrid({ children }: HighlightGridProps) {
  return <div className="grid gap-2 md:grid-cols-3">{children}</div>;
}

export function Highlight({
  heading,
  body,
}: {
  heading: string;
  body: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col justify-between gap-4 rounded-lg bg-sand-700 p-6",
        "first:col-span-full first:gap-12 first:bg-sand-800 first:sm:flex-row",
        "[&:first-child>.highlight-heading]:shrink-0 [&:first-child>.highlight-heading]:text-2xl [&:first-child>.highlight-heading]:sm:w-1/4"
      )}
    >
      <div className="highlight-heading font-serif font-semibold text-mustard-200">
        {heading}
      </div>
      <div className="text-sm text-mustard-50">{body}</div>
    </div>
  );
}
