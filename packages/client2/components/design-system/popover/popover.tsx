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
} from "@floating-ui/react-dom-interactions";
import { Transition } from "@headlessui/react";
import { useState, useEffect, Fragment, ReactNode, cloneElement } from "react";

interface PopoverProps {
  children: JSX.Element;
  content: ReactNode | (({ close }: { close: () => void }) => ReactNode);
  placement?: Placement;
}

export function Popover({
  children,
  content,
  placement = "bottom",
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { x, y, context, strategy, reference, floating, update, refs } =
    useFloating({
      open: isOpen,
      onOpenChange: setIsOpen,
      strategy: "fixed",
      placement,
      middleware: [offset(12), flip(), shift({ padding: 12 })],
    });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
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
      <FloatingPortal>
        <div
          ref={floating}
          {...getFloatingProps({
            ref: floating,
            style: {
              zIndex: 10,
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
              <FloatingFocusManager context={context} modal={false}>
                {typeof content === "function"
                  ? content({ close: () => setIsOpen(false) })
                  : content}
              </FloatingFocusManager>
            </div>
          </Transition>
        </div>
      </FloatingPortal>
    </>
  );
}
