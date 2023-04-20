import clsx from "clsx";
import { ReactElement, ReactNode } from "react";

import { ButtonProps } from "../button";
import { Icon, IconNameType } from "../icon";

export interface CallToActionBannerProps {
  /**
   * Button component props to optionally pass in
   */
  renderButton?: (
    props: Pick<ButtonProps, "colorScheme" | "size" | "variant">
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
        "max-w-screen rounded-md p-6",
        colorScheme === "blue-gradient"
          ? "bg-gradient-to-r from-sky-500 to-sky-300"
          : colorScheme === "white"
          ? "border-1 border-solid border-sand-200 bg-white"
          : colorScheme === "green"
          ? "bg-mint-500 shadow-md shadow-mint-500"
          : null
      )}
    >
      <div className="flex flex-col">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div
            className={clsx(
              colorScheme === "blue-gradient" || colorScheme === "green"
                ? "text-white"
                : colorScheme === "white"
                ? "text-sand-800"
                : null,
              "flex flex-col" /* will add more conditional statements for text scheme soon */
            )}
          >
            <div className="row mb-2 flex">
              {iconLeft && <Icon className="mt-1 mr-1" name={iconLeft} />}
              <h1>{title}</h1>
            </div>
            <p
              className={clsx(
                "float-left text-sm",
                colorScheme ===
                  "blue-gradient" /* will change this to be more based on text length */
                  ? "font-thin md:w-5/6 lg:w-2/3"
                  : null
              )}
            >
              {description}
            </p>
          </div>
          {renderButton
            ? renderButton({
                size: "md",
                colorScheme: "secondary",
                variant: "standard",
              })
            : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export default CallToActionBanner;
