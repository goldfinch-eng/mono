import clsx from "clsx";
import NextLink, { LinkProps as NextLinkProps } from "next/link";
import { HTMLAttributes } from "react";

interface LinkProps extends HTMLAttributes<HTMLAnchorElement> {
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
}

export function Link({ children, href, nextLinkProps, className }: LinkProps) {
  return (
    <NextLink passHref {...nextLinkProps} href={href}>
      <a className={clsx("underline hover:no-underline", className)}>
        {children}
      </a>
    </NextLink>
  );
}
