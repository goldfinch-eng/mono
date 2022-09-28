import clsx from "clsx";
import NextLink, { LinkProps as NextLinkProps } from "next/link";
import { AnchorHTMLAttributes } from "react";

import { Chip } from "../chip";
import { IconNameType, Icon } from "../icon";

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /**
   * Content within the link. Limited to strings only
   */
  children: string;
  /**
   * Destination URL. This can be any valid URL, but it should be a relative URL if it's meant to link within the app
   */
  href: string;
  /**
   * Advanced option for controlling props specific to Next.js' Link component
   */
  nextLinkProps?: NextLinkProps;
  className?: string;
  iconRight?: IconNameType;
  openInNewTab?: boolean;
}

export function Link({
  children,
  href,
  nextLinkProps,
  className,
  iconRight,
  openInNewTab = false,
  ...rest
}: LinkProps) {
  return (
    <NextLink passHref {...nextLinkProps} href={href}>
      <a
        className={clsx(
          "inline-flex items-center gap-1 underline hover:no-underline",
          className
        )}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noreferrer noopener" : undefined}
        {...rest}
      >
        {children}
        {iconRight ? <Icon name={iconRight} size="sm" /> : null}
      </a>
    </NextLink>
  );
}

interface ChipLinkProps extends Omit<LinkProps, "iconRight"> {
  iconLeft: IconNameType;
  hideTextOnSmallScreens?: boolean;
}

export function ChipLink({
  children,
  href,
  nextLinkProps,
  className,
  iconLeft,
  hideTextOnSmallScreens = true,
  ...rest
}: ChipLinkProps) {
  return (
    <Chip
      className={clsx(
        "group relative flex items-center hover:bg-sand-200 sm:gap-2",
        className
      )}
      colorScheme="sand"
    >
      <Icon name={iconLeft} size="sm" />
      <NextLink passHref {...nextLinkProps} href={href}>
        <a
          className="before:absolute before:inset-0 group-hover:underline"
          {...rest}
        >
          <span
            className={clsx(
              hideTextOnSmallScreens ? "sr-only sm:not-sr-only" : null
            )}
          >
            {children}
          </span>
        </a>
      </NextLink>
    </Chip>
  );
}
