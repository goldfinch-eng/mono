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
  orgType: "Credit Fund" | "Fintech";
  website: string;
  linkedIn: string;
  twitter?: string;
  logo: string;
  headerColor: string;
  bio: string;
  highlights: string[];
}

const defaultHeaderColor = "#f8f8f8";

export const BORROWER_METADATA: Record<string, Borrower> = {
  goldfinchTestBorrower: {
    name: "Goldfinch Test Borrower",
    orgType: "Fintech",
    website: "https://goldfinch.finance",
    linkedIn: "https://www.linkedin.com/company/goldfinchfinance/",
    twitter: "https://twitter.com/goldfinch_fi",
    logo: goldfinchLogo.src,
    headerColor: "#483e5e",
    bio: "Lorem ipsum",
    highlights: ["lorem", "ipsum"],
  },
  payjoy: {
    name: "Payjoy",
    orgType: "Fintech",
    website: "https://www.payjoy.com/",
    linkedIn: "https://www.linkedin.com/company/payjoy/",
    twitter: "https://twitter.com/PayJoy",
    logo: payjoyLogo.src,
    headerColor: defaultHeaderColor,
    bio: "PayJoy offers a buy-now-pay-later product that allows consumers to transform the purchases of mobile phones into monthly installment plans. The company has brought credit to millions of under-served consumers in emerging markets worldwide by collateralizing their smartphone to jumpstart them into the modern credit system. The company, based in San Francisco, California, was founded in 2015.",
    highlights: [
      "Payjoy has raised over $90M in equity and debt from leading investors such as Greylock and Union Square Ventures",
      "The company was founded in 2015, and is Headquartered in San Francisco, California",
    ],
  },
  aspire: {
    name: "Aspire",
    orgType: "Fintech",
    website: "https://aspireapp.com/",
    linkedIn: "https://www.linkedin.com/company/aspire-sea/",
    twitter: "https://twitter.com/AspireSEA",
    logo: aspireLogo.src,
    headerColor: "#12385b",
    bio: "Aspire is a modern bank for businesses in Southeast Asia. The company provides businesses with seamless payments, savings products, tools to help teams manage their finances, and a range of credit products to help businesses grow. Aspire was founded in 2018 to provide working capital loans for small to medium-sized businesses, and has since grown it's offering to include a suite of different products for its customers.",
    highlights: [
      "Aspire has raised over $150M in debt and equity from renowned global investors like Sequoia, Y Combinator, DST Global Partner, Picus Capital and more",
      "Over 10,000 businesses have opened accounts with Aspire, and they transact over $2 billion annually",
      "Aspire is headquartered in Singapore, and has operations in Indonesia and Vietnam",
    ],
  },
  quickcheck: {
    name: "QuickCheck",
    orgType: "Fintech",
    website: "https://quickcheck.ng/",
    linkedIn: "https://www.linkedin.com/company/quickcheck-nigeria/",
    twitter: "https://twitter.com/quickcheckng",
    logo: quickcheckLogo.src,
    headerColor: "#f25f22",
    bio: "QuickCheck is a Nigerian consumer lender that uses machine learning to provide loans instantly to its customers. Through their mobile app, customers can apply for loans and have them funded within minutes.",
    highlights: [
      "QuickCheck has disbursed over $10M in loans since inception, and is growing rapidly",
      "The company has was founded in 2018, and is headquartered in Lagos, Nigeria",
    ],
  },
  almavest: {
    name: "Almavest",
    orgType: "Credit Fund",
    website: "https://www.almavest.com//",
    linkedIn: "https://www.linkedin.com/company/almavest-impact/",
    logo: almavestLogo.src,
    headerColor: defaultHeaderColor,
    bio: "ALMA Sustainable Finance is an investment management firm that creatively deploys capital for sustainable development. Our debt platform serves high-growth, impact-oriented companies in a range of sectors, primarily in emerging and developing markets in Asia, Africa, and Latin America. ALMA invests in market-leading, impactful businesses led by experienced teams. Our portfolio companies and pipeline borrowers are backed by the world’s leading equity investors including Y Combinator, Acumen, Exxon Mobil, GE, FMO and others.\n\nWith prior executive or management roles at institutions such as CGAP (World Bank), FinDev Canada, SKS Microfinance (IPO), FastCash (acquired), Rainforest Alliance, and others, our leadership team has nearly 100 combined years of experience in building, scaling and exiting sustainable impact companies, impact debt and equity investing, and data analytics.",
    highlights: [
      "Since launch in 2020, we've deployed nearly $40 million and committed nearly $50 million to 11 companies with diverse underlying exposure — to multiple economic sectors and nearly 20 different global markets across Asia, Africa, and Latin America.",
    ],
  },
  tugende: {
    name: "Tugende",
    orgType: "Fintech",
    website: "https://gotugende.com/",
    linkedIn: "https://www.linkedin.com/company/tugende/",
    twitter: "https://twitter.com/tugende1",
    logo: tugendeLogo.src,
    headerColor: "#eb0c6e",
    bio: "Tugende is tackling the credit gap for small businesses in Africa by enabling informal entrepreneurs to own income-generating assets and build a verifiable digital credit profile based on real-world earning. Starting with motorcycle taxi operators, Tugende uses asset finance, technology, and a customer-centric model to help these entrepreneurs increase their economic trajectory.",
    highlights: [
      "Tugende have raised over $50M in equity from global debt and equity investors",
      "They have over 28,000 active clients",
      "21,000 assets have already been fully owned by alumni clients",
      "They employ over 750 full-time staff in Kenya and Uganda",
    ],
  },
  divibank: {
    name: "Divibank",
    orgType: "Fintech",
    website: "https://divibank.co/home",
    linkedIn: "https://www.linkedin.com/company/divibank/",
    logo: divibankLogo.src,
    headerColor: "#0f1078",
    bio: "Divibank is a data-driven financing platform that helps online businesses in Latin America scale by providing quick and affordable growth capital. The company provides revenue share loans along with a marketing analytics product to help online businesses scale in a capital-efficient way.",
    highlights: [
      "Divibank has raised over $8M in equity and debt funding to date from renowned global investors",
      "The Divibank team has deep product and financial services experience, having worked at Goldman Sachs, JP Morgan, Itau and Amazon",
    ],
  },
  cauris: {
    name: "Cauris",
    orgType: "Credit Fund",
    website: "https://www.caurisfinance.com/",
    linkedIn: "https://www.linkedin.com/company/cauris-inc/",
    twitter: "https://twitter.com/Caurisfinance",
    logo: caurisLogo.src,
    headerColor: "#681FF4",
    bio: "Cauris is a mission-driven investment firm that provides private credit to financial technology companies in emerging markets. Working across the Global South — with financings in Africa, Asia and Latin America — Cauris partners with fintechs that are making financial inclusion a reality for tens of millions of consumers and small businesses. Through debt investments, Cauris enables its partners to scale efforts that provide the traditionally underbanked access to financial services that improve their lives and livelihoods.  Leveraging Decentralized Finance (DeFi), Cauris aims to facilitate efforts that extend financial services to 100M people in line with its mission to empower individuals and small businesses through access to credit; to enable economic growth in emerging markets; and to accelerate the growth of the global middle class.",
    highlights: [
      "Cauris has never had a late payment, missed payment, or default.",
      "Strong performance track record with $15M borrowed on Goldfinch to date, generating high risk-adjusted yields for investors.",
    ],
  },
  stratos: {
    name: "Stratos",
    orgType: "Credit Fund",
    website: "https://www.stratos.xyz/",
    linkedIn: "https://www.linkedin.com/company/stratosxyz/",
    twitter: "https://twitter.com/StratosXYZ",
    logo: stratosLogo.src,
    headerColor: defaultHeaderColor,
    bio: "Stratos empowers founders to achieve their vision through rigorous engagement, strategic guidance, and capital. Stratos has the expertise and a five year track record of advising and financing technology and technology enabled businesses.",
    highlights: [
      "Stratos has never had a late payment, missed payment, or default in 5 years (60 months) of operation.",
      'Since inception in 2016, the Stratos Evergreen Structured Credit Fund ("SCF"), our longest running credit focused strategy, has generated gross annualized total returns of 18.95%',
    ],
  },
  lendeast: {
    name: "Lendeast",
    orgType: "Credit Fund",
    website: "https://lendeast.com/",
    linkedIn: "https://www.linkedin.com/company/lend-east/",
    logo: lendeastLogo.src,
    headerColor: defaultHeaderColor,
    bio: "Lend East is a digital lending platform that connects global institutional capital with alternate lenders in Emerging Asia (Southeast Asia & India). Lend East is revolutionising alternate lending by offering scalable growth capital with zero dilution to technology ventures. Leveraging Spa{R}³k, its proprietary credit and risk analytics platform, Lend East has made high impact investments in Indonesia, the Philippines, Singapore & Vietnam since 2019.",
    highlights: [
      "Since inception, Lend East has evaluated over 100 alternate lenders and onboarded 60+ of them on Spa{R}³k, its proprietary credit analytics & risk platform",
      "Lend East has committed US$50mn in investments across seven market leading platforms across Singapore, Indonesia, Philippines, Vietnam & India",
      "Strong performance track record, generating healthy risk adjusted yields for investors with no delays or defaults in borrower repayments",
    ],
  },
  addem: {
    name: "Addem Capital",
    orgType: "Credit Fund",
    website: "https://addem-capital.com/",
    linkedIn: "https://www.linkedin.com/company/addem-capital/",
    twitter: "https://twitter.com/AddemCapital",
    logo: addemLogo.src,
    headerColor: defaultHeaderColor,
    bio: "Addem Capital has developed a three-entity approach (Fund, Boutique Consulting Firm, Master Servicer) to increase liquidity in the LATAM capital markets, acting as scouts, funders, and monitoring agents within five verticals: fintech, real estate, energy, agriculture/sustainable foods, and healthcare.\n\nAddem Capital aims to become LATAM's most relevant liquidity provider by eliminating unnecessary debt intermediaries while reaching excellence in its underwriting and servicing processes.\n\nAll the monitoring and revisions on the collateral of the credit facilities are done by Addem's Master Servicer. Through its Internal Control Desk, it guarantees that all the performing assets satisfy the eligibility criteria for each facility. This enables Addem to hold more decision-making power on the line and be ahead of relevant risks.",
    highlights: [
      "Addem's fund and consulting firm (Latus) have invested and worked in more than five countries, including Mexico, Colombia, Chile, Brazil, and US-based entrepreneurs working in LATAM.",
      "Addem has evaluated and assessed +200 companies seeking financing and originated more than ten regional deals.",
      "Addem's internal control desk has audited +15,000 individual credits underwritten by their portfolio companies and pledged as collateral and source of payment for their debt facilities.",
      "After receiving debt from Addem Capital, all of their portfolio companies have secured Series A equity rounds with renowned investors such as Accel, Monashees, Y Combinator, Mouro Capital (Santander and SV LATAM).",
      "Addem's three-entity approach enables them to fully service. It monitors ongoing facilities without reducing efforts on scouting new opportunities to consolidate their pipeline and avoiding the reliance on third-party services to properly assess the quality of the asset originators' underwriting process and the asset itself.",
      "In Addem's first year of existence, it was recognized by Catalyst Fund and Brighter as one of the top 100 fintech investors across emerging markets.",
    ],
  },
};
