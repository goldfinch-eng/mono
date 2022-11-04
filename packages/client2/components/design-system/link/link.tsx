import clsx from "clsx";
import NextLink, { LinkProps as NextLinkProps } from "next/link";
import { AnchorHTMLAttributes } from "react";

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
}

export function Link({
  children,
  href,
  nextLinkProps,
  className,
  iconRight,
  ...rest
}: LinkProps) {
  return (
    <NextLink passHref {...nextLinkProps} href={href}>
      <a
        className={clsx(
          "inline-flex items-center gap-1 underline hover:no-underline",
          className
        )}
        {...rest}
      >
        {children}
        {iconRight ? <Icon name={iconRight} size="sm" /> : null}
      </a>
    </NextLink>
  );
}
