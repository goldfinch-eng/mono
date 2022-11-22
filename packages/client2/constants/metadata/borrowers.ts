import addemLogo from "./icons/addem.png";
import almavestLogo from "./icons/almavest.png";
import aspireLogo from "./icons/aspire.png";
import caurisLogo from "./icons/cauris.png";
import divibankLogo from "./icons/divibank.png";
import goldfinchLogo from "./icons/goldfinch.png";
import lendeastLogo from "./icons/lendeast.png";
import payjoyLogo from "./icons/payjoy.png";
import quickcheckLogo from "./icons/quickcheck.png";
import stratosLogo from "./icons/stratos.jpeg";
import tugendeLogo from "./icons/tugende.png";

interface Borrower {
  name: string;
  logo: string;
}

export const BORROWER_METADATA: Record<string, Borrower> = {
  goldfinchTestBorrower: {
    name: "Goldfinch Test Borrower",
    logo: goldfinchLogo.src,
  },
  payjoy: {
    name: "Payjoy",
    logo: payjoyLogo.src,
  },
  aspire: {
    name: "Aspire",
    logo: aspireLogo.src,
  },
  quickcheck: {
    name: "QuickCheck",
    logo: quickcheckLogo.src,
  },
  almavest: {
    name: "Almavest",
    logo: almavestLogo.src,
  },
  tugende: {
    name: "Tugende",
    logo: tugendeLogo.src,
  },
  divibank: {
    name: "Divibank",
    logo: divibankLogo.src,
  },
  cauris: {
    name: "Cauris",
    logo: caurisLogo.src,
  },
  stratos: {
    name: "Stratos",
    logo: stratosLogo.src,
  },
  lendeast: {
    name: "Lendeast",
    logo: lendeastLogo.src,
  },
  addem: {
    name: "Addem Capital",
    logo: addemLogo.src,
  },
};
