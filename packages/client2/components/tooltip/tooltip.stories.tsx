import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Link } from "../link";
import { Tooltip, InfoIconTooltip } from "./index";

export default {
  title: "Components/Tooltip",
  component: Tooltip,
} as ComponentMeta<typeof Tooltip>;

const SampleContent = () => (
  <div className="max-w-xs">
    <div className="mb-4 text-xl font-bold">Secured Type</div>
    <div>
      Lorem ipsum dolor sit amet, elit ut aliquam, purus sit amet luctus
      venenatis, lectus magna fringilla.
      <br />
      <Link href="#">I am clickable</Link>
    </div>
  </div>
);

export const TooltipStory: ComponentStory<typeof Tooltip> = () => (
  <div>
    Scroll down and interact with the tooltip
    <div
      className="flex items-center justify-center"
      style={{ height: "1000px" }}
    >
      <Tooltip placement="right" content={<SampleContent />}>
        <button>hover me</button>
      </Tooltip>
    </div>
  </div>
);

export const InfoIconTooltipStory: ComponentStory<
  typeof InfoIconTooltip
> = () => (
  <div>
    Scroll down and interact with the tooltip
    <div
      className="flex items-center justify-center"
      style={{ height: "1000px" }}
    >
      <InfoIconTooltip placement="right" content={<SampleContent />} />
    </div>
  </div>
);
