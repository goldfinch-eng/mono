import { Dialog, Transition } from "@headlessui/react";
import clsx from "clsx";
import { ReactNode, Fragment } from "react";

import { Icon } from "../icon";

export interface DrawerProps {
  /**
   * Boolean that controls whether or not the drawer is open. Don't conditionally render the <Drawer> component in your tree, that will break the animations.
   */
  isOpen: boolean;
  /**
   * Callback that will be invoked when the drawer is closed.
   */
  onClose: () => void;
  /**
   * Choose where the drawer comes from on the screen
   */
  from: "left" | "right" | "bottom";
  /**
   * Contents of the drawer
   */
  children: ReactNode;
  /**
   * Optional title that will be shown at the top of the contents.
   */
  title?: string;
  /**
   * Optional decription
   */
  description?: string;
  /**
   * Controls the maximum width of the modal. Only takes effect when `from` is "left" or "right"
   */
  size: "sm" | "md" | "lg";
}

export function Drawer({
  isOpen,
  onClose,
  from,
  children,
  title,
  description,
  size,
}: DrawerProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="fixed inset-0 z-50 h-full w-full">
        <Transition.Child
          as={Fragment}
          enter="transition-opacity duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Dialog.Overlay className="fixed inset-0 bg-sand-300 bg-opacity-80" />
        </Transition.Child>
        <Transition.Child
          as={Fragment}
          enter="transition-transform duration-500"
          enterFrom={
            from === "left"
              ? "-translate-x-full"
              : from === "right"
              ? "translate-x-full"
              : from === "bottom"
              ? "translate-y-full"
              : undefined
          }
          enterTo="transform-none"
          leave="transition-transform duration-500"
          leaveFrom="transform-none"
          leaveTo={
            from === "left"
              ? "-translate-x-full"
              : from === "right"
              ? "translate-x-full"
              : from === "bottom"
              ? "translate-y-full"
              : undefined
          }
        >
          <div
            className={clsx(
              "fixed overflow-auto bg-white p-6 shadow-lg md:p-12",
              from === "left" && "top-0 left-0 h-full",
              from === "right" && "top-0 right-0 h-full",
              from === "bottom" && "bottom-0 right-0 w-full",
              "w-full",
              size === "sm" && from !== "bottom"
                ? "md:max-w-screen-sm"
                : size === "md" && from !== "bottom"
                ? "md:max-w-screen-md"
                : size === "lg" && from !== "bottom"
                ? "md:max-w-screen-lg"
                : null
            )}
          >
            <div className="mb-8">
              {title && (
                <Dialog.Title className="font-serif text-3xl font-semibold">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description>{description}</Dialog.Description>
              )}
            </div>
            {children}
            <button onClick={onClose} className="absolute top-4 right-4">
              <Icon name="X" size="md" />
            </button>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}
