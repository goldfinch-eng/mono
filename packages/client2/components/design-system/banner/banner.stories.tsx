import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Banner } from "./index";

export default {
  title: "Components/Banner",
  component: Banner,
  argTypes: {
    initialContent: {
      control: {
        type: "text",
      },
    },
    expandedContent: {
      control: {
        type: "text",
      },
    },
  },
} as ComponentMeta<typeof Banner>;

export const BannerStory: ComponentStory<typeof Banner> = (args) => {
  return <Banner {...args} />;
};

BannerStory.args = {
  initialContent: "Bacon ipsum",
  expandedContent:
    "Bacon ipsum dolor amet beef ribs pork loin buffalo, shoulder picanha spare ribs short ribs tri-tip venison jowl meatball frankfurter bacon pastrami. Biltong filet mignon alcatra shankle brisket boudin. Chuck drumstick cow doner beef jowl ground round meatloaf. Chislic shoulder burgdoggen beef ribs, pork chop prosciutto ground round capicola pork. Chicken tenderloin capicola beef ribs leberkas swine ground round corned beef beef meatball jerky. Meatball cow tongue venison ball tip, short loin spare ribs shankle kevin pancetta cupim buffalo bacon. Boudin chicken prosciutto shoulder cow pork belly pastrami capicola rump beef ribs landjaeger buffalo strip steak short ribs kielbasa.",
};
