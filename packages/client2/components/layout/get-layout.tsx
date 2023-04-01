import { ReactElement, ReactNode } from "react";

import { assertUnreachable } from "@/lib/utils";

import { DefaultLayout } from "./default-layout";

export type Layout = "mustard-background" | "white-background";

export function getLayout(
  layoutName: Layout
): (page: ReactElement) => ReactNode {
  switch (layoutName) {
    case "mustard-background":
      return function MustardBackgroundLayout(page) {
        return <DefaultLayout className="bg-mustard-50">{page}</DefaultLayout>;
      };
    case "white-background":
      return function WhiteBackgroundLayout(page) {
        return <DefaultLayout className="bg-white">{page}</DefaultLayout>;
      };
    default:
      assertUnreachable(layoutName);
  }
}
