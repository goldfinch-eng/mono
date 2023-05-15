import {
  Placement,
  useFloating,
  useInteractions,
  useHover,
  useFocus,
  useRole,
  useDismiss,
  offset,
  shift,
  flip,
  arrow,
  safePolygon,
  autoUpdate,
  FloatingPortal,
} from "@floating-ui/react";
import { Transition } from "@headlessui/react";
import clsx from "clsx";
import {
  ReactNode,
  useState,
  useEffect,
  useRef,
  Fragment,
  cloneElement,
} from "react";

import { Icon, IconSizeType } from "../icon";

interface TooltipProps {
  /**
   * The element that should be hovered to display this tooltip. This element should be one that naturally accepts keyboard focus (such as a button). If it is not, also pass the `useWrapper` prop
   */
  children: JSX.Element;
  /**
   * When true, `children` will be wrapped in an inline div which will receive focus and hover events
   */
  useWrapper?: boolean;
  /**
   * The actual content of the tooltip.
   */
  content: ReactNode;
  /**
   * The desired placement for the tooltip. Note that this may be adjusted depending on space available for the tooltip
   */
  placement?: Placement;
}

export function Tooltip({
  children,
  useWrapper = false,
  content,
  placement = "top",
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const {
    x,
    y,
    reference,
    floating,
    strategy,
    placement: actualPlacement,
    context,
    refs,
    update,
    middlewareData: { arrow: { x: arrowX, y: arrowY } = {} },
  } = useFloating({
    strategy: "fixed",
    placement,
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(12),
      flip(),
      shift({ padding: 12 }),
      arrow({ element: arrowRef, padding: 8 }),
    ],
  });

  const arrowSide =
    {
      top: "bottom",
      right: "left",
      bottom: "top",
      left: "right",
    }[actualPlacement.split("-")[0]] ?? "";

  useEffect(() => {
    if (refs.reference.current && refs.floating.current && isOpen) {
      return autoUpdate(refs.reference.current, refs.floating.current, update);
    }
  }, [refs.reference, refs.floating, update, isOpen]);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, {
      restMs: 100,
      handleClose: safePolygon(),
    }),
    useRole(context, { role: "tooltip" }),
    useFocus(context),
    useDismiss(context),
  ]);

  return (
    <>
      {useWrapper ? (
        <div
          className="relative inline-flex"
          tabIndex={0}
          {...getReferenceProps({ ref: reference })}
        >
          {children}
        </div>
      ) : (
        cloneElement(
          children,
          getReferenceProps({ ref: reference, ...children.props })
        )
      )}
      <FloatingPortal preserveTabOrder>
        <div
          ref={floating}
          {...getFloatingProps({
            ref: floating,
            style: {
              zIndex: 999,
              position: strategy,
              top: y ?? "",
              left: x ?? "",
            },
          })}
        >
          <Transition
            as={Fragment}
            show={isOpen}
            enter="transition duration-200 ease-in"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-200 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <div className="relative min-w-max rounded-md border border-sand-100 bg-white p-3 text-sm drop-shadow-lg">
              {typeof content === "string" ? (
                <div className="max-w-[250px]">{content}</div>
              ) : (
                content
              )}
              <div
                ref={arrowRef}
                style={{
                  left: arrowX,
                  top: arrowY,
                  [arrowSide]: "-7px",
                  width: "12px",
                  height: "12px",
                }}
                className={clsx(
                  "absolute origin-center rotate-45 border-sand-100 bg-white",
                  actualPlacement.startsWith("top")
                    ? "border-r border-b"
                    : actualPlacement.startsWith("right")
                    ? "border-l border-b"
                    : actualPlacement.startsWith("bottom")
                    ? "border-l border-t"
                    : actualPlacement.startsWith("left")
                    ? "border-t border-r"
                    : null
                )}
              />
            </div>
          </Transition>
        </div>
      </FloatingPortal>
    </>
  );
}

interface InfoIconTooltipProps
  extends Omit<TooltipProps, "children" | "useWrapper"> {
  /**
   * The size of the icon: "xs" | "sm" | "md" | "lg" | "text"
   */
  size?: IconSizeType;
  /**
   * Class goes on the info icon
   */
  className?: string;
}

export function InfoIconTooltip({
  size = "sm",
  className,
  ...props
}: InfoIconTooltipProps) {
  return (
    <Tooltip useWrapper {...props}>
      <Icon
        name="InfoCircle"
        size={size}
        className={clsx(className, "text-sand-400")}
      />
    </Tooltip>
  );
}
