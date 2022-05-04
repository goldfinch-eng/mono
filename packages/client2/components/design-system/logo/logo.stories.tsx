import { Story, Meta } from "@storybook/react";

import { GoldfinchLogo } from ".";

export default {
  title: "Components/Logo",
  component: GoldfinchLogo,
} as Meta;

export const LogoStory: Story<typeof GoldfinchLogo> = () => {
  return <GoldfinchLogo className="h-10 w-10" />;
};
