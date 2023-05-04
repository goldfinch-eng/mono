import { ReactElement, ReactNode } from "react";

import { assertUnreachable } from "@/lib/utils";

import { DefaultLayout } from "./default-layout";
import { NakedLayout } from "./naked-layout";

export type Layout = "mustard-background" | "white-background" | "naked";

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
    case "naked":
      return function NakedBackgroundLayout(page) {
        return <NakedLayout>{page}</NakedLayout>;
      };
    default:
      assertUnreachable(layoutName);
  }
}
