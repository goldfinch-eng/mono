import { ReactNode } from "react";

import { ButtonProps } from "../button";
import { IconProps } from "../icon";

export interface CallToActionProps {
  /**
   * Optional button that user would click on as a part of the call to action
   */
  buttonProps?: ButtonProps;
  /**
   * Optional children that render below the call to action button.
   */
  children?: ReactNode;
  className?: string;
  /**
   * Image appearing to the left of the title
   */
  icon: IconProps;
}
