import clsx from "clsx";
import { forwardRef } from "react";

import ArrowDownCircle from "./svg/arrow-down-circle-solid.svg";
import ArrowDown from "./svg/arrow-down.svg";
import ArrowSmRight from "./svg/arrow-sm-right.svg";
import ArrowTopRight from "./svg/arrow-top-right.svg";
import ArrowUpCircle from "./svg/arrow-up-circle-solid.svg";
import ArrowUp from "./svg/arrow-up.svg";
import CheckmarkCircle from "./svg/checkmark-circle-solid.svg";
import Checkmark from "./svg/checkmark.svg";
import ChevronDown from "./svg/chevron-down.svg";
import Copy from "./svg/copy.svg";
import Discord from "./svg/discord.svg";
import DotsHorizontal from "./svg/dots-horizontal.svg";
import Exclamation from "./svg/exclamation.svg";
import Gfi from "./svg/gfi.svg";
import InfoCircle from "./svg/info-circle-solid.svg";
import Link from "./svg/link.svg";
import LinkedIn from "./svg/linkedin.svg";
import Menu from "./svg/menu.svg";
import Twitter from "./svg/twitter.svg";
import Usdc from "./svg/usdc.svg";
import Wallet from "./svg/wallet.svg";
import X from "./svg/x.svg";

export const iconManifest = {
  ArrowDown,
  ArrowDownCircle,
  ArrowSmRight,
  ArrowTopRight,
  ArrowUp,
  ArrowUpCircle,
  Checkmark,
  CheckmarkCircle,
  ChevronDown,
  Copy,
  Discord,
  DotsHorizontal,
  Exclamation,
  Gfi,
  InfoCircle,
  Link,
  LinkedIn,
  Menu,
  Twitter,
  Usdc,
  Wallet,
  X,
};

export type IconNameType = keyof typeof iconManifest;
export type IconSizeType = "xs" | "sm" | "md" | "lg" | "text";

export interface IconProps {
  name: keyof typeof iconManifest;
  size?: IconSizeType;
  className?: string;
}

export function sizeToClassName(size: IconProps["size"]) {
  return size === "xs"
    ? "h-4 w-4"
    : size === "sm"
    ? "h-5 w-5"
    : size === "md"
    ? "h-6 w-6"
    : size === "lg"
    ? "h-8 w-8"
    : size === "text"
    ? "h-[1em] w-[1em]"
    : undefined;
}

export const Icon = forwardRef<SVGElement, IconProps>(function Icon(
  { name, size = "text", className }: IconProps,
  ref
) {
  const IconComponent = iconManifest[name];
  return (
    <IconComponent
      aria-hidden="true"
      ref={ref}
      className={clsx(sizeToClassName(size), "inline shrink-0", className)}
    />
  );
});
