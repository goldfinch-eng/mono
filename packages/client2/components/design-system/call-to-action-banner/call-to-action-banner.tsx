import clsx from "clsx";
import { ReactElement, ReactNode } from "react";

import { ButtonProps } from "../button";
import { Icon, IconNameType } from "../icon";

export interface CallToActionBannerProps {
  /**
   * Button component props to optionally pass in
   */
  renderButton?: (
    props: Pick<ButtonProps, "colorScheme" | "size" | "variant" | "className">
  ) => ReactElement;
  /**
   * Optional children that render below the call to action button
   */
  children?: ReactNode;
  /**
   * Image appearing to the left of the title
   */
  iconLeft?: IconNameType;
  /**
   * Color schemes representing the buttons that are being added to the component. By default it's "blue-gradient".
   */
  colorScheme?: "blue-gradient" | "green" | "mustard" | "white";
  /**
   * Heading that appears at the top of the component
   */
  title: string;
  /**
   * Gives a description to the body of this component
   */
  description?: string;
}

export function CallToActionBanner({
  renderButton,
  children,
  colorScheme = "blue-gradient",
  iconLeft,
  title,
  description,
}: CallToActionBannerProps) {
  return (
    <div
      className={clsx(
        "rounded-md p-6",
        colorScheme === "blue-gradient"
          ? "bg-gradient-to-r from-sky-500 to-sky-300 text-white"
          : colorScheme === "white"
          ? "border-1 border-solid border-sand-200 bg-white text-sand-800"
          : colorScheme === "green"
          ? "bg-mint-500 text-white shadow-md shadow-mint-500"
          : null
      )}
    >
      <div>
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-1">
              {iconLeft ? <Icon name={iconLeft} /> : null}
              {title}
            </div>
            <p className="text-sm">{description}</p>
          </div>
          {renderButton
            ? renderButton({
                size: "md",
                colorScheme: "secondary",
                variant: "standard",
                className: "shrink-0",
              })
            : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export default CallToActionBanner;
