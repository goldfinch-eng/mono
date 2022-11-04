import { Dialog, Transition } from "@headlessui/react";
import clsx from "clsx";
import { ReactNode, Fragment } from "react";

import { Icon } from "../icon";

export interface ModalProps {
  /**
   * Controls whether or not the modal is currently open. Do not conditionally render the <Modal> component, otherwise the closing animation can't work.
   */
  isOpen: boolean;
  /**
   * Callback that gets invoked when the user closes the modal. This should be used to set isOpen to false.
   */
  onClose: () => void;
  /**
   * Contents that appear inside of the modal.
   */
  children: ReactNode;
  /**
   * The max width of the modal.
   */
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * Heading that appears at the top of the modal
   */
  title: ReactNode;
  /**
   * Gives a screen-reader accessible description to this modal.
   */
  description?: string;
  /**
   * Adds a divider between the modal's title and content
   */
  divider?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  children,
  size = "md",
  title,
  description,
  divider = true,
}: ModalProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        open={isOpen}
        onClose={onClose}
        className="fixed inset-0 z-10 flex items-center justify-center"
      >
        <Transition.Child
          as={Fragment}
          enter="transition-opacity duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Dialog.Overlay className="fixed inset-0 bg-sand-300 bg-opacity-80" />
        </Transition.Child>
        <Transition.Child
          as={Fragment}
          enter="transition-all duration-150"
          enterFrom="scale-95 opacity-0"
          enterTo="scale-100 opacity-100"
          leave="transition-all duration-150"
          leaveFrom="scale-100 opacity-100"
          leaveTo="scale-95 opacity-0"
        >
          <div
            className={clsx(
              "relative mx-2 my-4 w-full rounded-xl border border-sand-100 bg-white py-6 shadow-2xl",
              size === "xs"
                ? "max-w-screen-xs"
                : size === "sm"
                ? "max-w-screen-sm"
                : size === "md"
                ? "max-w-screen-md"
                : size === "lg"
                ? "max-w-screen-lg"
                : null
            )}
          >
            <div
              className={clsx(
                "flex items-center justify-between gap-12 px-6 pb-4",
                divider ? "border-b border-b-sand-100" : null
              )}
            >
              <div>
                <Dialog.Title className="text-lg font-semibold">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description>{description}</Dialog.Description>
                )}
              </div>
              <button onClick={onClose}>
                <Icon name="X" size="md" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto">
              <div className="px-6 pt-4 pb-1">{children}</div>
            </div>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}
