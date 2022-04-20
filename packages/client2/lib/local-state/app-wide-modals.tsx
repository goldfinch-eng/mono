/**
 * The general rule of thumb for deciding whether or not to place a modal in here is simply that it should be in here if it serves a purpose that shows up in multiple places throughout the app.
 */
import { useReactiveVar } from "@apollo/client";
// import {
//   createContext,
//   useContext,
//   useState,
//   useCallback,
//   ReactNode,
// } from "react";

import { WalletModal } from "@/components/wallet-modal";

import { closeWalletModal } from "./actions";
import { isWalletModalOpenVar } from "./vars";

// interface ModalContextInterface {
//   openWalletModal: () => void;
// }

// const ModalContext = createContext<ModalContextInterface>(
//   {} as ModalContextInterface
// );

// export const useModal = () => useContext(ModalContext);

// export function ModalProvider({ children }: { children: ReactNode }) {
//   const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
//   const openWalletModal = useCallback(() => setIsWalletModalOpen(true), []);

//   return (
//     <ModalContext.Provider value={{ openWalletModal }}>
//       {children}
//       <WalletModal
//         isOpen={isWalletModalOpen}
//         onClose={() => setIsWalletModalOpen(false)}
//       />
//     </ModalContext.Provider>
//   );
// }

export function AppWideModals() {
  const isWalletModalOpen = useReactiveVar(isWalletModalOpenVar); // too lazy to write a full graphQL query just to read this from the Apollo cache, so i useReactiveVar on it
  return (
    <>
      <WalletModal isOpen={isWalletModalOpen} onClose={closeWalletModal} />
    </>
  );
}
