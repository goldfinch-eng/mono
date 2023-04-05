import clsx from "clsx";
import Image from "next/future/image";
import { forwardRef } from "react";

import Curve from "./raster/curve.png";
import ArrowDownCircle from "./svg/arrow-down-circle-solid.svg";
import ArrowDown from "./svg/arrow-down.svg";
import ArrowLeft from "./svg/arrow-left.svg";
import ArrowSmRight from "./svg/arrow-sm-right.svg";
import ArrowTopRight from "./svg/arrow-top-right.svg";
import ArrowUpCircle from "./svg/arrow-up-circle-solid.svg";
import ArrowUp from "./svg/arrow-up.svg";
import CheckmarkCircle from "./svg/checkmark-circle-solid.svg";
import Checkmark from "./svg/checkmark.svg";
import ChevronDown from "./svg/chevron-down.svg";
import Clock from "./svg/clock.svg";
import Copy from "./svg/copy.svg";
import Discord from "./svg/discord.svg";
import DollarSolid from "./svg/dollar-solid.svg";
import DotsHorizontal from "./svg/dots-horizontal.svg";
import ExclamationCircleSolid from "./svg/exclamation-circle-solid.svg";
import Exclamation from "./svg/exclamation.svg";
import Gfi from "./svg/gfi.svg";
import Globe from "./svg/globe.svg";
import InfoCircle from "./svg/info-circle-solid.svg";
import LightningBolt from "./svg/lightning-bolt.svg";
import Link from "./svg/link.svg";
import LinkedIn from "./svg/linkedin.svg";
import LockClosed from "./svg/lock-closed.svg";
import Menu from "./svg/menu.svg";
import Twitter from "./svg/twitter.svg";
import Usdc from "./svg/usdc.svg";
import Wallet from "./svg/wallet.svg";
import X from "./svg/x.svg";

export const iconManifest = {
  ArrowDown,
  ArrowDownCircle,
  ArrowLeft,
  ArrowSmRight,
  ArrowTopRight,
  ArrowUp,
  ArrowUpCircle,
  Checkmark,
  CheckmarkCircle,
  ChevronDown,
  Clock,
  Copy,
  Curve,
  Discord,
  DollarSolid,
  DotsHorizontal,
  Exclamation,
  ExclamationCircleSolid,
  Gfi,
  Globe,
  InfoCircle,
  LightningBolt,
  Link,
  LinkedIn,
  LockClosed,
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
  if (typeof IconComponent === "string" || IconComponent.width) {
    return (
      <Image
        src={IconComponent}
        className={clsx(
          sizeToClassName(size),
          "inline shrink-0 object-contain p-0.5"
        )}
        sizes={
          size === "xs"
            ? "16px"
            : size === "sm"
            ? "20px"
            : size === "md"
            ? "24px"
            : "32px"
        }
        alt=""
        aria-hidden="true"
        quality={100}
      />
    );
  }
  return (
    <IconComponent
      aria-hidden="true"
      ref={ref}
      className={clsx(sizeToClassName(size), "inline shrink-0", className)}
    />
  );
});
