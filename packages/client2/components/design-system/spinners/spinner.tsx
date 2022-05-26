import clsx from "clsx";
import { SVGAttributes } from "react";

import { IconProps, sizeToClassName } from "../icon";
import SpinnerSvg from "./spinner.svg";

interface SpinnerProps extends SVGAttributes<SVGElement> {
  size?: IconProps["size"];
}

export function Spinner({ size = "text", className, ...rest }: SpinnerProps) {
  return (
    <SpinnerSvg
      className={clsx("spinner animate-spin", sizeToClassName(size), className)}
      {...rest}
    />
  );
}
