import {
  useFloating,
  useInteractions,
  useClick,
  useDismiss,
  useRole,
  shift,
  flip,
  offset,
  autoUpdate,
  Placement,
  FloatingFocusManager,
  FloatingPortal,
  useHover,
  useFocus,
  safePolygon,
} from "@floating-ui/react";
import { Transition } from "@headlessui/react";
import { useState, useEffect, Fragment, ReactNode, cloneElement } from "react";

interface PopoverProps {
  children: JSX.Element;
  content: ReactNode | (({ close }: { close: () => void }) => ReactNode);
  placement?: Placement;
  offset?: number;
  trigger?: "click" | "hover";
}

export function Popover({
  children,
  content,
  placement = "bottom",
  offset: offsetAmount = 12,
  trigger = "click",
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { x, y, context, strategy, reference, floating, update, refs } =
    useFloating({
      open: isOpen,
      onOpenChange: setIsOpen,
      strategy: "fixed",
      placement,
      middleware: [offset(offsetAmount), flip(), shift({ padding: 12 })],
    });

  // The `trigger` prop is never expected to change for the lifetime of an instance of this component. This is a little sneaky, but I think this is acceptable.
  /* eslint-disable react-hooks/rules-of-hooks */
  const interactions =
    trigger === "click"
      ? [useClick(context)]
      : [
          useHover(context, { restMs: 10, handleClose: safePolygon() }),
          useFocus(context),
        ];
  /* eslint-enable react-hooks/rules-of-hooks */

  const { getReferenceProps, getFloatingProps } = useInteractions([
    ...interactions,
    useRole(context),
    useDismiss(context),
  ]);

  useEffect(() => {
    if (refs.reference.current && refs.floating.current && isOpen) {
      return autoUpdate(refs.reference.current, refs.floating.current, update);
    }
  }, [refs.reference, refs.floating, update, isOpen]);

  return (
    <>
      {cloneElement(
        children,
        getReferenceProps({ ref: reference, ...children.props })
      )}
      <FloatingPortal preserveTabOrder>
        <FloatingFocusManager
          context={context}
          modal={false}
          order={["reference", "content"]}
          initialFocus={-1}
        >
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
              <div className="min-w-max rounded-md border border-sand-100 bg-white p-4 drop-shadow-lg">
                {typeof content === "function"
                  ? content({ close: () => setIsOpen(false) })
                  : content}
              </div>
            </Transition>
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    </>
  );
}
