import clsx from "clsx";
import { SVGAttributes } from "react";

import SpinnerSvg from "./spinner.svg";

export function Spinner({ className, ...rest }: SVGAttributes<SVGElement>) {
  return (
    <SpinnerSvg
      className={clsx(
        "h-8 w-8 animate-spin fill-purple-300 text-sand-100",
        className
      )}
      {...rest}
    />
  );
}
