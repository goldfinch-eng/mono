import { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

import { Button } from "../button";
import { Modal } from "./modal";

/**
 * Allows you to show a confirm dialog to the user and await their confirmation. Useful in a pinch, but do not overuse this. It doesn't come with transition animations like <Modal /> and should be considered an escape hatch for when you need an imperative confirm dialog.
 * @param children React node to show inside the confirm dialog. This does not include the cancel/confirm buttons.
 * @returns A promise that resolves to `true` if the user clicks "Confirm" in the dialog, or `false` if they click "Cancel". Also, if the user dismisses the modal, the promise will resolve to `false`.
 */
export function confirmDialog(
  children: ReactNode,
  includeButtons = true
): Promise<boolean> {
  const confirmRoot = document.createElement("div");
  document.body.append(confirmRoot);
  return new Promise((resolve) => {
    const handleClose = (result: boolean) => () => {
      resolve(result);
      unmountComponentAtNode(confirmRoot);
      document.body.removeChild(confirmRoot);
    };
    render(
      <Modal title="Alert" isOpen size="xs" onClose={handleClose(false)}>
        <div className="text-center">{children}</div>
        {includeButtons ? (
          <div className="mt-4 flex gap-4">
            <Button
              className="grow"
              size="xl"
              colorScheme="secondary"
              onClick={handleClose(false)}
            >
              Cancel
            </Button>
            <Button className="grow" size="xl" onClick={handleClose(true)}>
              Confirm
            </Button>
          </div>
        ) : null}
      </Modal>,
      confirmRoot
    );
  });
}
