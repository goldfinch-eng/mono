import addemLogo from "./icons/addem.png";
import almavestLogo from "./icons/almavest.png";
import aspireLogo from "./icons/aspire.png";
import caurisLogo from "./icons/cauris.png";
import divibankLogo from "./icons/divibank.png";
import lendeastLogo from "./icons/lendeast.png";
import payjoyLogo from "./icons/payjoy.png";
import quickcheckLogo from "./icons/quickcheck.png";
import stratosLogo from "./icons/stratos.jpeg";
import tugendeLogo from "./icons/tugende.png";
import type { PoolMetadata } from "./types";

export const mainnetMetadata: Record<string, PoolMetadata> = {
  "0xd43a4f3041069c6178b99d55295b00d0db955bb5": {
    name: "Cauris Fund #3: Africa Innovation Pool",
    category: "Africa multi-sector loans",
    icon: caurisLogo.src,
    dataroom:
      "https://www.notion.so/goldfinchfinance/Cauris-Borrower-Pool-3-Overview-2a127e4075a5406abe3c9c5a6868b08d",
    agreement: "https://docsend.com/view/428qxv8dq7uhgj8j/d/ej5z3qnrdb59wzaz",
    launchTime: 1651590000,
    poolDescription:
      "Proceeds will be used to provide additional backing to African fintechs in their quest to provide access to financial services to millions of traditionally underbanked customers. Our investments will include senior secured loans with covenants for additional downside protection. All loans will be secured by all-asset debentures, including our borrowers’ lending receivables.",
    poolHighlights: [
      "Cauris uses data-driven approaches to underwriting and portfolio management efforts and a combination of strong asset-level underwriting, structural and legal protections and advanced analytics to secure our debt investments in all fintech partners.",
      "Cauris only invests in Fintechs characterized by management teams with deep, relevant experience in their companies’ sectors; well-performing loan books to use as collateral; and support by marquee VC, PE and strategic investors.",
      "Pool investments will target companies providing consumer and SME lending products as well as trade and equipment financing.",
    ],
    borrowerDescription:
      "Cauris is a mission-driven investment firm that provides private credit to financial technology companies in emerging markets. Working across the Global South — with financings in Africa, Asia and Latin America — Cauris partners with fintechs that are making financial inclusion a reality for tens of millions of consumers and small businesses.\n\nThrough debt investments, Cauris enables its partners to scale efforts that provide the traditionally underbanked access to financial services that improve their lives and livelihoods.  Leveraging Decentralized Finance (DeFi), Cauris aims to facilitate efforts that extend financial services to 100M people in line with its mission to empower individuals and small businesses through access to credit; to enable economic growth in emerging markets; and to accelerate the growth of the global middle class.",
    borrowerHighlights: [
      "Cauris has never had a late payment, missed payment, or default.",
      "Strong performance track record with $15M borrowed on Goldfinch to date, generating high risk-adjusted yields for investors.",
    ],
  },
  "0x89d7c618a4eef3065da8ad684859a547548e6169": {
    name: "Asset-Backed Pool via Addem Capital",
    category: "LATAM asset-backed multi-sector loans",
    icon: addemLogo.src,
    dataroom:
      "https://www.notion.so/goldfinchfinance/Addem-Capital-Borrower-Pool-Overview-4530f7c83ddb4fb39d6f8b44ddcead64",
    agreement:
      "https://addemcapital.docsend.com/view/rwchikv6dxnpa5wa/d/fcbpk9yde3a73pnb",
    launchTime: 1650466800,
    poolDescription:
      "Proceeds will be used to leverage Addem Capital's existing fund Utopia I, which holds positions on different structures with borrowers, all of them being asset-backed debt lines in one of the five verticals of the fund's thesis: fintech, real estate, energy, agro/sustainable foods, and healthcare. All current and future Utopia I facilities are for LATAM-based companies with solid management and which are actively contributing to the strengthening of the entrepreneur ecosystem in the region.",
    poolHighlights: [
      "These companies must have a strong technological component and proven track record of originating consistent cash flow-generating assets.",
      "The debt facilities Addem Capital structure will be used to fund self-liquidating assets where Addem has complete traceability and control of all the cash flows pledged as the source of payment, which positions them at the best risk-to-return ratio in Mexico and LATAM.",
      "Addem fund these structures' senior and mezzanine tranches with an interest rate ranging between 18 - 22% in MXN for unsubordinated lines and 24 - 35 % for subordinated ones.",
    ],
    borrowerDescription:
      "Addem Capital has developed a three-entity approach (Fund, Boutique Consulting Firm, Master Servicer) to increase liquidity in the LATAM capital markets, acting as scouts, funders, and monitoring agents within five verticals: fintech, real estate, energy, agriculture/sustainable foods, and healthcare.\n\nAddem Capital aims to become LATAM's most relevant liquidity provider by eliminating unnecessary debt intermediaries while reaching excellence in its underwriting and servicing processes.\n\nAll the monitoring and revisions on the collateral of the credit facilities are done by Addem's Master Servicer. Through its Internal Control Desk, it guarantees that all the performing assets satisfy the eligibility criteria for each facility. This enables Addem to hold more decision-making power on the line and be ahead of relevant risks.",
    borrowerHighlights: [
      "Addem's fund and consulting firm (Latus) have invested and worked in more than five countries, including Mexico, Colombia, Chile, Brazil, and US-based entrepreneurs working in LATAM.",
      "Addem has evaluated and assessed +200 companies seeking financing and originated more than ten regional deals.",
      "Addem's internal control desk has audited +15,000 individual credits underwritten by their portfolio companies and pledged as collateral and source of payment for their debt facilities.",
      "After receiving debt from Addem Capital, all of their portfolio companies have secured Series A equity rounds with renowned investors such as Accel, Monashees, Y Combinator, Mouro Capital (Santander and SV LATAM).",
      "Addem's three-entity approach enables them to fully service. It monitors ongoing facilities without reducing efforts on scouting new opportunities to consolidate their pipeline and avoiding the reliance on third-party services to properly assess the quality of the asset originators' underwriting process and the asset itself.",
      "In Addem's first year of existence, it was recognized by Catalyst Fund and Brighter as one of the top 100 fintech investors across emerging markets.",
    ],
  },
  "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3": {
    name: "Almavest Basket #7: Fintech and Carbon Reduction Basket",
    category: "Global multi-sector loans",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This facility will be utilized by Almavest to invest in a) inclusive lenders (which pledge pools of underlying microfinance, small business, or other loans as collateral); and b) carbon reduction project developers (which pledge carbon offsets or receivables from their sale as collateral).",
    icon: almavestLogo.src,
    agreement: "https://docsend.com/view/i7gd73kutdaymw9z/d/fapydfdk3syv7pns",
    dataroom:
      "https://almavest.notion.site/ALMA-BASKET-7-Pool-Overview-dd4ae721d6ea4c1fad9b17ba8abdd3ac",
    launchTime: 1649343600,
    poolDescription:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses.  This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines and other markets.\n\nThe security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares.\n\nIn addition, ALMA is helping Goldfinch to improve the climate impacts of DeFi by offsetting the carbon footprint of all ALMA Borrower Pool contracts for this, from the date they are created through the entire loan term on the Ethereum blockchain, effectively making this a carbon neutral DeFi pool.",
    poolHighlights: [
      "Selfin, an Indian lender that provides small, medium-term loans to MSMEs in India through a distribution network of financial advisors.",
      "JuanchoTePresta, a fintech Colombian lender that targets employees, gig workers, and students with on-demand loans, with 60% women customers.",
      "Greenway Appliances, a leading clean cookstove supplier and distributor, with hundreds of thousands of rural customers in India and Africa",
      "Impact Water, which supplies over 30,000 schools across central and eastern Africa with systems that avoid burning fuel to make water safe and potable",
      "Trella, a leading digital transportation and logistics platform focused on the Middle East, with clients and investors including Maersk and Exxon",
    ],
    borrowerDescription:
      "ALMA Sustainable Finance is an investment management firm that creatively deploys capital for sustainable development. Our debt platform serves high-growth, impact-oriented companies in a range of sectors, primarily in emerging and developing markets in Asia, Africa, and Latin America. ALMA invests in market-leading, impactful businesses led by experienced teams. Our portfolio companies and pipeline borrowers are backed by the world’s leading equity investors including Y Combinator, Acumen, Exxon Mobil, GE, FMO and others.\n\nWith prior executive or management roles at institutions such as CGAP (World Bank), FinDev Canada, SKS Microfinance (IPO), FastCash (acquired), Rainforest Alliance, and others, our leadership team has nearly 100 combined years of experience in building, scaling and exiting sustainable impact companies, impact debt and equity investing, and data analytics.",
    borrowerHighlights: [
      "Since launch in 2020, we've deployed nearly $40 million and committed nearly $50 million to 11 companies with diverse underlying exposure — to multiple economic sectors and nearly 20 different global markets across Asia, Africa, and Latin America.",
    ],
  },
  "0xb26b42dd5771689d0a7faeea32825ff9710b9c11": {
    name: "Lend East #1: Emerging Asia Fintech Pool",
    category: "Global multi-sector loans",
    icon: lendeastLogo.src,
    agreement: "https://lendeast.docsend.com/view/s/i395ds3s3gsxkrcc",
    launchTime: 1647529200,
    poolDescription:
      "Proceeds will be used for additional funding via existing Lend East Credit Facilities to our portfolio companies and funding of new alternate lending platforms in Emerging Asia. All Lend East Credit Facilities are senior secured loans to high growth, tech forward Alternate Lenders who are backed by marquee equity investors like Ant Financial, Sequoia Capital, DST Global, Sinar Mas, Quona Capital & Arbor Ventures.\n\nEvery facility is structured to provide a healthy risk adjusted return to investors while ensuring capital preservation. Typical guardrails include excess portfolio cover (1.2x - 1.5x of the investment), established seniority over equity & other debt capital on the balance sheet and corporate guarantees from Holding Companies.",
    poolHighlights: [
      "Project Puma: Largest alternate consumer lending player serving underserved segments in Indonesia; raised over US$ 250 million in equity till date",
      "Project Ocelot: Leading alternate consumer lending player, pioneering Offline-to-Online (O2O) lending in The Philippines; raised over US$ 100 million in equity since inception",
      "Project Falcon: Small business focused neo-bank operating in Singapore & Vietnam; raised over US$ 70 million dollar in equity till date",
      "Project Stork: Fast growing digital consumer lending platform in Indonesia; raised over US$ 40 million dollar in equity till date",
      "Project Toucan: Leading Buy-Now-Pay-Later (BNPL) based in Singapore; raised ~US$ 500 million dollars in equity till date",
    ],
    borrowerDescription:
      "Lend East is a digital lending platform that connects global institutional capital with alternate lenders in Emerging Asia (Southeast Asia & India). Lend East is revolutionising alternate lending by offering scalable growth capital with zero dilution to technology ventures. Leveraging Spa{R}³k, its proprietary credit and risk analytics platform, Lend East has made high impact investments in Indonesia, the Philippines, Singapore & Vietnam since 2019.",
    borrowerHighlights: [
      "Since inception, Lend East has evaluated over 100 alternate lenders and onboarded 60+ of them on Spa{R}³k, its proprietary credit analytics & risk platform",
      "Lend East has committed US$50mn in investments across seven market leading platforms across Singapore, Indonesia, Philippines, Vietnam & India",
      "Strong performance track record, generating healthy risk adjusted yields for investors with no delays or defaults in borrower repayments",
    ],
  },
  "0xd09a57127bc40d680be7cb061c2a6629fe71abef": {
    name: "Cauris Fund #2: Africa Innovation Pool",
    category: "Global multi-sector loans",
    description:
      "Cauris is a mission driven company that applies advanced technology to solve financial inclusion issues while providing high risk adjusted returns to its investors.\n\nWe aim to give 100 million more people access to capital. We believe that access to credit is key to empowering individuals and enabling economic growth. We use a combination of strong underwriting, legal protections and advanced analytics to secure our debt investments in our fintechs clients.\n\nThis pool will be dedicated to backing African fintechs in their quest to provide access to financial services to millions of customers. We will be investing in companies providing consumer lending products, SME, Trade and equipment financings. Our investments will include senior secured loans to companies such as:\n\n• Ramani (https://www.ramani.io/), a supply chain financing company operating in Tanzanian\n• Jetstream (https://jetstreamafrica.com/), a trade finance company operating in Ghana and Nigeria\n• Asaak (https://www.asaak.com/), an equipment financing company providing motorcycle financing to boda bodas (motorcycle taxis) in Uganda\n• Gozem (https://gozem.co/en/), on-demand transportation, delivery and cashless payment solutions provider operating in Francophone West and Central Africa",
    icon: caurisLogo.src,
    agreement: "https://docsend.com/view/s/hbhpdkjv63kgwi47",
    launchTime: 1645027200,
  },
  "0x00c27fc71b159a346e179b4a1608a0865e8a7470": {
    name: "Secured U.S. Fintech Yield via Stratos",
    category: "Global multi-sector loans",
    icon: stratosLogo.src,
    agreement: "https://docsend.com/view/s/fntuciz53snd43ki",
    launchTime: 1644595200,
    poolDescription:
      "Proceeds will be used for additional fundings via existing Stratos Credit Facilities to Three Colts, Rezi and Braavo. All current Stratos Credit Facilities are senior secured loans to U.S. domiciled borrowers, and also include covenants for additional downside protection. The asset-backed Rezi and Braavo credit facilities are secured by cash flow generating assets, and the Three Colts credit facility is secured by all assets of the cash flow positive company.",
    poolHighlights: [
      "Three Colts was founded to acquire, grow and launch Ecommerce SaaS companies that provide enterprise software to businesses that operate on Amazon, Shopify and other online retail platforms.",
      "Rezi is an institutional-scale residential lease broker, making a market in multifamily leases. Rezi enters into master-leases with multifamily landlords at a discount to the sum of the expected tenant rent payments, and then sub-leases residential units included in its master-leases to individual tenants.",
      "Braavo is a data-driven accounts receivable financing platform that provides scalable funding solutions to mobile app businesses, largely on the Apple App Store and Google Play.",
    ],
    borrowerDescription:
      "Stratos empowers founders to achieve their vision through rigorous engagement, strategic guidance, and capital. Stratos has the expertise and a five year track record of advising and financing technology and technology enabled businesses.",
    borrowerHighlights: [
      "Stratos has never had a late payment, missed payment, or default in 5 years (60 months) of operation.",
      'Since inception in 2016, the Stratos Evergreen Structured Credit Fund ("SCF"), our longest running credit focused strategy, has generated gross annualized total returns of 18.95%',
    ],
  },
  "0x418749e294cabce5a714efccc22a8aade6f9db57": {
    name: "Almavest Basket #6",
    category: "Global multi-sector loans",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This facility will be utilized by Almavest to invest in a) inclusive lenders (which pledge pools of underlying microfinance, small business, or other loans as collateral); and b) carbon reduction project developers (which pledge carbon offsets or receivables from their sale as collateral).",
    icon: almavestLogo.src,
    agreement: "https://docsend.com/view/vcxfarda3vn72mxz/d/sc6a39p3my8k3uw8",
    launchTime: 1644249600,
  },
  "0x1d596d28a7923a22aa013b0e7082bba23daa656b": {
    name: "Almavest Basket #5",
    category: "Global multi-sector loans",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This facility will be utilized by Almavest to invest in a) inclusive lenders (which pledge pools of underlying microfinance, small business, or other loans as collateral); and b) carbon reduction project developers (which pledge carbon offsets or receivables from their sale as collateral).",
    icon: almavestLogo.src,
    agreement: "https://docsend.com/view/r9dpyy8wqxp2n5td/d/k87sbpm4ny3s23y6",
  },
  "0xc9bdd0d3b80cc6efe79a82d850f44ec9b55387ae": {
    name: "Cauris",
    category: "Global multi-sector loans",
    description:
      "Cauris is a credit fund created to bring decentralized financing to fintechs in emerging markets. This facility will be used by Cauris to provide debt capital to vetted consumer and SMB lenders in the Global South and Europe, who pledge well-performing loan portfolios as collateral.",
    icon: caurisLogo.src,
  },
  "0xf74ea34ac88862b7ff419e60e476be2651433e68": {
    name: "Divibank",
    category: "SMB Loans in Latin America",
    description:
      "Divibank is a data-driven financing platform that helps online businesses in Latin America scale by providing quick and affordable growth capital. The company provides revenue share loans along with a marketing analytics product to help online businesses scale in a capital-efficient way.",
    icon: divibankLogo.src,
  },
  "0xaa2ccc5547f64c5dffd0a624eb4af2543a67ba65": {
    name: "Tugende",
    category: "Asset Finance Loans in Kenya",
    description:
      "Tugende uses asset finance, technology, and a customer-centric model to help informal sector entrepreneurs increase their economic trajectory. By providing them with financing and value-added services, Tugende is building a long-term ecosystem for Micro, Small & Medium Enterprises (MSMEs) to grow.",
    icon: tugendeLogo.src,
  },
  "0xd798d527f770ad920bb50680dbc202bb0a1dafd6": {
    name: "QuickCheck #1",
    category: "Consumer loans in Nigeria",
    description:
      "QuickCheck uses machine learning to provide loans instantly to customers in Nigeria. Through its mobile app, customers can apply for a loan, and have them funded in minutes.",
    icon: quickcheckLogo.src,
  },
  "0x2107ade0e536b8b0b85cca5e0c0c3f66e58c053c": {
    name: "QuickCheck #2",
    category: "Consumer loans in Nigeria",
    description:
      "QuickCheck uses machine learning to provide loans instantly to customers in Nigeria. Through its mobile app, customers can apply for a loan, and have them funded in minutes.",
    icon: quickcheckLogo.src,
  },
  "0x1cc90f7bb292dab6fa4398f3763681cfe497db97": {
    name: "QuickCheck #3",
    category: "Consumer loans in Nigeria",
    description:
      "QuickCheck uses machine learning to provide loans instantly to customers in Nigeria. Through its mobile app, customers can apply for a loan, and have them funded in minutes.",
    icon: quickcheckLogo.src,
  },
  "0x3634855ec1beaf6f9be0f7d2f67fc9cb5f4eeea4": {
    name: "Aspire #1",
    category: "SME loans in Southeast Asia",
    description:
      "Aspire is a modern bank for businesses in Southeast Asia. The company provides businesses with seamless payments, savings products, tools to help teams manage their finances, and a range of credit products to help businesses grow.",
    icon: aspireLogo.src,
  },
  "0x9e8b9182abba7b4c188c979bc8f4c79f7f4c90d3": {
    name: "Aspire #2",
    category: "SME loans in Southeast Asia",
    description:
      "Aspire is a modern bank for businesses in Southeast Asia. The company provides businesses with seamless payments, savings products, tools to help teams manage their finances, and a range of credit products to help businesses grow.",
    icon: aspireLogo.src,
  },
  "0x8bbd80f88e662e56b918c353da635e210ece93c6": {
    name: "Aspire #3",
    category: "SME loans in Southeast Asia",
    description:
      "Aspire is a modern bank for businesses in Southeast Asia. The company provides businesses with seamless payments, savings products, tools to help teams manage their finances, and a range of credit products to help businesses grow.",
    icon: aspireLogo.src,
  },
  "0x1e73b5c1a3570b362d46ae9bf429b25c05e514a7": {
    name: "PayJoy",
    category: "Smartphone financing in Mexico",
    description:
      "PayJoy offers a buy-now-pay-later product that allows consumers to transform the purchases of mobile phones into monthly installment plans. They serve customers in Mexico and other emerging markets.",
    icon: payjoyLogo.src,
  },
  "0x67df471eacd82c3dbc95604618ff2a1f6b14b8a1": {
    name: "Almavest Basket #1",
    category: "Global, multi-sector loans",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This loan was used to provide debt capital to Selfin - an SME lender in India, Upwards - an consumer lender in India, Impact Water - a company that provides safe drinking water systems in Africa, and Greenway - an Indian company that makes ‘clean cookstoves’ for low-income households globally.",
    icon: almavestLogo.src,
  },
  "0xe32c22e4d95cae1fb805c60c9e0026ed57971bcf": {
    name: "Almavest Basket #2",
    category: "Global, multi-sector loans",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This loan was used to provide debt capital to Adelantos - an asset financier providing loans secured on mobile phones across LatAm.",
    icon: almavestLogo.src,
  },
  "0xefeb69edf6b6999b0e3f2fa856a2acf3bdea4ab5": {
    name: "Almavest Basket #3",
    category: "Global, multi-sector loans",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This facility will be utilized by Almavest to invest in a) inclusive lenders (which pledge pools of underlying microfinance, small business, or other loans as collateral); and b) carbon reduction project developers (which pledge carbon offsets or receivables from their sale as collateral).",
    icon: almavestLogo.src,
    agreement:
      "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/a22b60ac-89b7-4184-a6ba-3ed16c45ab8f/ALMA_Goldfinch_Protocol_Loan_Agreement_FINAL_%288-30-21%29.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAT73L2G45O3KS52Y5%2F20210831%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20210831T000715Z&X-Amz-Expires=86400&X-Amz-Signature=01c8b63f01e46afb753c4f37ba75836b0743fa8e82ce94fbf32aefbbad367e6a&X-Amz-SignedHeaders=host&response-content-disposition=filename%20%3D%22ALMA%2520Goldfinch%2520Protocol%2520Loan%2520Agreement%2520FINAL%2520%288-30-21%29.pdf%22",
  },
  "0xe6c30756136e07eb5268c3232efbfbe645c1ba5a": {
    name: "Almavest Basket #4",
    category: "Global, multi-sector loans",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This facility will be utilized by Almavest to invest in a) inclusive lenders (which pledge pools of underlying microfinance, small business, or other loans as collateral); and b) carbon reduction project developers (which pledge carbon offsets or receivables from their sale as collateral).",
    icon: almavestLogo.src,
  },
  "0xc13465ce9ae3aa184eb536f04fdc3f54d2def277": {
    name: "Oya, via Almavest",
    category: "SMB loans in Africa",
    description:
      "Almavest provides debt capital to high-performing companies in a variety of sectors globally. This loan was used to provide debt capital to Oya - an asset financier providing loans helping small and medium sized business across Africa scale up.",
    icon: almavestLogo.src,
  },
};
