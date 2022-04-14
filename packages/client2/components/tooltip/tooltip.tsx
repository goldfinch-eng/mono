import { Popover, Transition } from "@headlessui/react";
import clsx from "clsx";
import { ReactNode, useState, useRef } from "react";
import { usePopper } from "react-popper"; // TODO switch to @floating-ui. Popper sucks and it gets the arrow placement wrong unless it's "top" or "right"

import { Icon } from "../icon";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  placement?: "top" | "right";
}

export function Tooltip({
  children,
  content,
  placement = "top",
}: TooltipProps) {
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement>();
  const [popperElement, setPopperElement] = useState();
  const [arrowElement, setArrowElement] = useState();
  const { styles, attributes, state } = usePopper(
    referenceElement,
    popperElement,
    {
      strategy: "absolute",
      placement,
      modifiers: [
        { name: "offset", options: { offset: [0, 12] } },
        { name: "preventOverflow", options: { padding: 16 } },
        { name: "arrow", options: { element: arrowElement, padding: 10 } },
      ],
    }
  );

  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const closeDelay = 100;
  const handleMouseEnter = () => {
    if (!isTooltipOpen) {
      setIsTooltipOpen(true);
      referenceElement?.click();
    }
    clearTimeout(closeTimeoutRef.current as unknown as number);
  };
  const handleMouseLeave = () => {
    if (isTooltipOpen) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsTooltipOpen(false);
        referenceElement?.click();
      }, closeDelay);
    }
  };

  return (
    <Popover
      className="group relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Popover.Button
        // @ts-expect-error the ref type doesn't cover callback refs, which are still valid
        ref={setReferenceElement}
        className="group-hover:unfocused"
      >
        {children}
      </Popover.Button>
      <Transition
        className="absolute"
        enter="transition duration-200 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-200 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <Popover.Panel
          // @ts-expect-error the ref type doesn't cover callback refs, which are still valid
          ref={setPopperElement}
          style={styles.popper}
          {...attributes.popper}
          className="min-w-max rounded-md border border-sand-100 bg-white"
        >
          <div className="p-4">{content}</div>
          <div
            // @ts-expect-error the ref type doesn't cover callback refs, which are still valid
            ref={setArrowElement}
            style={styles.arrow}
            {...attributes.arrow}
          >
            <div
              className={clsx(
                "absolute -top-1.5 -left-1.5 h-3 w-3 origin-center rotate-45 border-sand-100 bg-white",
                state?.placement.startsWith("top")
                  ? "border-r border-b"
                  : state?.placement.startsWith("right")
                  ? "border-l border-b"
                  : state?.placement.startsWith("bottom")
                  ? "border-l border-t"
                  : state?.placement.startsWith("left")
                  ? "border-t border-r"
                  : null
              )}
            />
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}

export function InfoIconTooltip(props: Omit<TooltipProps, "children">) {
  return (
    <Tooltip {...props}>
      <Icon name="InfoCircle" />
    </Tooltip>
  );
}
