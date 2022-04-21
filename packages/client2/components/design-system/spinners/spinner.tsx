import clsx from "clsx";
import { SVGAttributes } from "react";

import SpinnerSvg from "./spinner.svg";

export function Spinner({ className, ...rest }: SVGAttributes<SVGElement>) {
  return (
    <SpinnerSvg className={clsx("spinner animate-spin", className)} {...rest} />
  );
}
