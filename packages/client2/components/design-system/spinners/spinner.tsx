import clsx from "clsx";
import { SVGAttributes } from "react";

import SpinnerSvg from "./spinner.svg";

export function Spinner({ className, ...rest }: SVGAttributes<SVGElement>) {
  return (
    <SpinnerSvg
      className={clsx("spinner h-8 w-8 animate-spin", className)}
      {...rest}
    />
  );
}
