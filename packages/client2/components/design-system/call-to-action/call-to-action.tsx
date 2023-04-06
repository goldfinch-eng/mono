import clsx from "clsx";
import { MouseEventHandler, ReactNode } from "react";

import { Button } from "../button";
import { Icon, IconNameType } from "../icon";

export type CallToActionButtonProps = {
  /**
   * Onclick function for the call to action button component
   */
  onClick: MouseEventHandler<HTMLButtonElement> &
    MouseEventHandler<HTMLAnchorElement>;
  /**
   * Text appearing on the call to action button component
   */
  name: string;
};

export interface CallToActionProps {
  /**
   * Button component props to optionally pass in
   */
  buttonRight?: CallToActionButtonProps;
  /**
   * Optional children that render below the call to action button
   */
  children?: ReactNode;
  /**
   * Image appearing to the left of the title
   */
  iconLeft?: IconNameType;
  /**
   * Color schemes representing the buttons that are being added to the component. By default it's primary.
   */
  colorScheme?: "primary" | "flat" | "special";
  /**
   * Heading that appears at the top of the component
   */
  title: string;
  /**
   * Gives a description to the body of this component
   */
  description?: string;
}

export function CallToAction({
  buttonRight,
  children,
  colorScheme = "primary",
  iconLeft,
  title,
  description,
}: CallToActionProps) {
  return (
    <div
      className={clsx(
        "max-w-screen rounded-md p-6",
        colorScheme === "primary"
          ? "bg-gradient-to-r from-sky-600 to-sky-400"
          : "bg-twilight-50" /* will add more conditional statements for color scheme soon */
      )}
    >
      <div className="flex flex-col">
        <div className="row flex justify-between">
          <div
            className={clsx(
              colorScheme === "primary" ? "text-white" : "text-sand-800",
              "flex flex-col" /* will add more conditional statements for text scheme soon */
            )}
          >
            <div className="row mb-2 flex">
              {iconLeft && <Icon className="mt-1 mr-1" name={iconLeft} />}
              <h1>{title}</h1>
            </div>
            <p className="float-left text-sm font-thin md:w-5/6 lg:w-2/3">
              {description}
            </p>
          </div>
          {buttonRight && (
            <Button
              className="m-auto md:h-1/2  md:w-1/2 lg:h-1/2 lg:w-1/5"
              colorScheme="secondary"
              onClick={buttonRight.onClick}
            >
              {buttonRight.name}
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export default CallToAction;
