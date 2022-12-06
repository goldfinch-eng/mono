import {
  Link as ReactRouterLink,
  LinkProps as ReactRouterLinkProps,
  useHref,
  useLinkClickHandler,
} from "react-router-dom";

import { Button, ButtonProps } from "@/components/design-system";

export function Link(props: ReactRouterLinkProps) {
  return (
    <ReactRouterLink {...props}>
      <span className="underline hover:no-underline">{props.children}</span>
    </ReactRouterLink>
  );
}

export function ButtonLink({ to, ...rest }: ButtonProps & { to: string }) {
  const href = useHref(to);
  const handleClick = useLinkClickHandler(to);

  return (
    <Button
      as="a"
      href={href}
      iconRight="ArrowSmRight"
      {...rest}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onClick={(e) => handleClick(e as any)}
    />
  );
}
