import { MouseEventHandler, ReactNode } from "react";

import { Button } from "../button";
import { Icon, IconNameType } from "../icon";

type CallToActionButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement> &
    MouseEventHandler<HTMLAnchorElement>;
  name: string;
};

export interface CallToActionProps {
  /**
   * Button component to optionally pass in
   */
  buttonRight?: CallToActionButtonProps;
  /**
   * Optional children that render below the call to action button
   */
  children?: ReactNode;
  className?: string;
  /**
   * Image appearing to the left of the title
   */
  iconLeft: IconNameType;
  /**
   * Color schemes representing the buttons that are being added to the component
   */
  colorScheme: "primary" | "flat" | "special";
  /**
   * Heading that appears at the top of the component
   */
  title: string;
  /**
   * Gives a description to this modal
   */
  description?: string;
}

export function CallToAction({
  buttonRight,
  children,
  className,
  iconLeft,
  colorScheme,
  title,
  description,
}: CallToActionProps) {
  return (
    <div className="max-w-screen rounded bg-twilight-500 p-6 text-white">
      <div className="row flex justify-between">
        <div className="row flex">
          <Icon className="mt-1 mr-1" name={iconLeft} />
          <h1>{title}</h1>
        </div>
        {buttonRight && (
          <Button
            name={buttonRight.name}
            onClick={buttonRight.onClick}
          ></Button>
        )}
      </div>
    </div>
  );
}

export default CallToAction;
