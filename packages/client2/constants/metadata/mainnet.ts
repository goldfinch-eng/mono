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
    borrower: "cauris",
    name: "Cauris Fund #3: Africa Innovation Pool",
    category: "Africa multi-sector loans",
    icon: caurisLogo.src,
    dataroom:
      "https://goldfinchfinance.notion.site/Africa-Innovation-Enterprise-Pool-via-Cauris-2a127e4075a5406abe3c9c5a6868b08d",
    agreement: "https://docsend.com/view/428qxv8dq7uhgj8j/d/ej5z3qnrdb59wzaz",
    launchTime: 1651590000,
    description:
      "Proceeds will be used to provide additional backing to African fintechs in their quest to provide access to financial services to millions of traditionally underbanked customers. Our investments will include senior secured loans with covenants for additional downside protection. All loans will be secured by all-asset debentures, including our borrowers’ lending receivables.",
    highlights: [
      "Cauris uses data-driven approaches to underwriting and portfolio management efforts and a combination of strong asset-level underwriting, structural and legal protections and advanced analytics to secure our debt investments in all fintech partners.",
      "Cauris only invests in Fintechs characterized by management teams with deep, relevant experience in their companies’ sectors; well-performing loan books to use as collateral; and support by marquee VC, PE and strategic investors.",
      "Pool investments will target companies providing consumer and SME lending products as well as trade and equipment financing.",
    ],
  },
  "0x89d7c618a4eef3065da8ad684859a547548e6169": {
    borrower: "addem",
    name: "Asset-Backed Pool via Addem Capital",
    category: "LATAM asset-backed multi-sector loans",
    icon: addemLogo.src,
    dataroom:
      "https://goldfinchfinance.notion.site/Addem-Capital-Borrower-Pool-Overview-4530f7c83ddb4fb39d6f8b44ddcead64",
    agreement:
      "https://addemcapital.docsend.com/view/rwchikv6dxnpa5wa/d/fcbpk9yde3a73pnb",
    launchTime: 1650466800,
    description:
      "Proceeds will be used to leverage Addem Capital's existing fund Utopia I, which holds positions on different structures with borrowers, all of them being asset-backed debt lines in one of the five verticals of the fund's thesis: fintech, real estate, energy, agro/sustainable foods, and healthcare. All current and future Utopia I facilities are for LATAM-based companies with solid management and which are actively contributing to the strengthening of the entrepreneur ecosystem in the region.",
    highlights: [
      "These companies must have a strong technological component and proven track record of originating consistent cash flow-generating assets.",
      "The debt facilities Addem Capital structure will be used to fund self-liquidating assets where Addem has complete traceability and control of all the cash flows pledged as the source of payment, which positions them at the best risk-to-return ratio in Mexico and LATAM.",
      "Addem fund these structures' senior and mezzanine tranches with an interest rate ranging between 18 - 22% in MXN for unsubordinated lines and 24 - 35 % for subordinated ones.",
    ],
    lateFeeApr: 0.18
  },
  "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3": {
    borrower: "almavest",
    name: "Almavest Basket #7: Fintech and Carbon Reduction Basket",
    category: "Global multi-sector loans",
    icon: almavestLogo.src,
    agreement: "https://docsend.com/view/i7gd73kutdaymw9z/d/fapydfdk3syv7pns",
    dataroom:
      "https://almavest.notion.site/ALMA-BASKET-7-Pool-Overview-dd4ae721d6ea4c1fad9b17ba8abdd3ac",
    launchTime: 1649343600,
    description:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses. This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines and other markets. The security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares. In addition, ALMA is helping Goldfinch to improve the climate impacts of DeFi by offsetting the carbon footprint of all ALMA Borrower Pool contracts for this, from the date they are created through the entire loan term on the Ethereum blockchain, effectively making this a carbon neutral DeFi pool.",
    highlights: [
      "Selfin, an Indian lender that provides small, medium-term loans to MSMEs in India through a distribution network of financial advisors.",
      "JuanchoTePresta, a fintech Colombian lender that targets employees, gig workers, and students with on-demand loans, with 60% women customers.",
      "Greenway Appliances, a leading clean cookstove supplier and distributor, with hundreds of thousands of rural customers in India and Africa",
      "Impact Water, which supplies over 30,000 schools across central and eastern Africa with systems that avoid burning fuel to make water safe and potable",
      "Trella, a leading digital transportation and logistics platform focused on the Middle East, with clients and investors including Maersk and Exxon",
    ],
  },
  "0xb26b42dd5771689d0a7faeea32825ff9710b9c11": {
    borrower: "lendeast",
    name: "Lend East #1: Emerging Asia Fintech Pool",
    category: "Global multi-sector loans",
    icon: lendeastLogo.src,
    agreement: "https://lendeast.docsend.com/view/s/i395ds3s3gsxkrcc",
    dataroom: "https://lendeast.docsend.com/view/s/i395ds3s3gsxkrcc",
    launchTime: 1647529200,
    description:
      "Proceeds will be used for additional funding via existing Lend East Credit Facilities to our portfolio companies and funding of new alternate lending platforms in Emerging Asia. All Lend East Credit Facilities are senior secured loans to high growth, tech forward Alternate Lenders who are backed by marquee equity investors like Ant Financial, Sequoia Capital, DST Global, Sinar Mas, Quona Capital & Arbor Ventures.\n\nEvery facility is structured to provide a healthy risk adjusted return to investors while ensuring capital preservation. Typical guardrails include excess portfolio cover (1.2x - 1.5x of the investment), established seniority over equity & other debt capital on the balance sheet and corporate guarantees from Holding Companies.",
    highlights: [
      "Project Puma: Largest alternate consumer lending player serving underserved segments in Indonesia; raised over US$ 250 million in equity till date",
      "Project Ocelot: Leading alternate consumer lending player, pioneering Offline-to-Online (O2O) lending in The Philippines; raised over US$ 100 million in equity since inception",
      "Project Falcon: Small business focused neo-bank operating in Singapore & Vietnam; raised over US$ 70 million dollar in equity till date",
      "Project Stork: Fast growing digital consumer lending platform in Indonesia; raised over US$ 40 million dollar in equity till date",
      "Project Toucan: Leading Buy-Now-Pay-Later (BNPL) based in Singapore; raised ~US$ 500 million dollars in equity till date",
    ],
  },
  "0xd09a57127bc40d680be7cb061c2a6629fe71abef": {
    borrower: "cauris",
    name: "Cauris Fund #2: Africa Innovation Pool",
    category: "Global multi-sector loans",
    description:
      "Cauris is a mission driven company that applies advanced technology to solve financial inclusion issues while providing high risk adjusted returns to its investors.\n\nWe aim to give 100 million more people access to capital. We believe that access to credit is key to empowering individuals and enabling economic growth. We use a combination of strong underwriting, legal protections and advanced analytics to secure our debt investments in our fintechs clients.\n\nThis pool will be dedicated to backing African fintechs in their quest to provide access to financial services to millions of customers. We will be investing in companies providing consumer lending products, SME, Trade and equipment financings. Our investments will include senior secured loans to companies such as:\n\n• Ramani (https://www.ramani.io/), a supply chain financing company operating in Tanzanian\n• Jetstream (https://jetstreamafrica.com/), a trade finance company operating in Ghana and Nigeria\n• Asaak (https://www.asaak.com/), an equipment financing company providing motorcycle financing to boda bodas (motorcycle taxis) in Uganda\n• Gozem (https://gozem.co/en/), on-demand transportation, delivery and cashless payment solutions provider operating in Francophone West and Central Africa",
    icon: caurisLogo.src,
    agreement: "https://docsend.com/view/s/hbhpdkjv63kgwi47",
    dataroom: "https://docsend.com/view/s/hbhpdkjv63kgwi47",
    launchTime: 1645027200,
  },
  "0x00c27fc71b159a346e179b4a1608a0865e8a7470": {
    borrower: "stratos",
    name: "Secured U.S. Fintech Yield via Stratos",
    category: "Global multi-sector loans",
    icon: stratosLogo.src,
    agreement: "https://docsend.com/view/s/fntuciz53snd43ki",
    dataroom: "https://docsend.com/view/s/fntuciz53snd43ki",
    launchTime: 1644595200,
    description:
      "Proceeds will be used for additional fundings via existing Stratos Credit Facilities to Three Colts, Rezi and Braavo. All current Stratos Credit Facilities are senior secured loans to U.S. domiciled borrowers, and also include covenants for additional downside protection. The asset-backed Rezi and Braavo credit facilities are secured by cash flow generating assets, and the Three Colts credit facility is secured by all assets of the cash flow positive company.",
    highlights: [
      "Three Colts was founded to acquire, grow and launch Ecommerce SaaS companies that provide enterprise software to businesses that operate on Amazon, Shopify and other online retail platforms.",
      "Rezi is an institutional-scale residential lease broker, making a market in multifamily leases. Rezi enters into master-leases with multifamily landlords at a discount to the sum of the expected tenant rent payments, and then sub-leases residential units included in its master-leases to individual tenants.",
      "Braavo is a data-driven accounts receivable financing platform that provides scalable funding solutions to mobile app businesses, largely on the Apple App Store and Google Play.",
    ],
    lateFeeApr: 0.13
  },
  "0x418749e294cabce5a714efccc22a8aade6f9db57": {
    borrower: "almavest",
    name: "Almavest Basket #6",
    category: "Global multi-sector loans",
    description:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses.  This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines, and other markets. The security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares.",
    highlights: [
      "Selfin, an Indian lender that provides small, medium-term loans to MSMEs in India through a distribution network of financial advisors.",
      "Upwards, a consumer lender which, through its mobile app, offers personal loans to salaried employees  in India",
      "Impact Water which supplies over 30,000 schools across central and eastern Africa with systems that avoid burning fuel to make water safe and potable",
      "Greenway Appliances, a leading clean cookstove supplier and distributor, with hundreds of thousands of rural customers in India and Africa",
    ],
    icon: almavestLogo.src,
    agreement: "https://docsend.com/view/vcxfarda3vn72mxz/d/sc6a39p3my8k3uw8",
    dataroom: "https://docsend.com/view/vcxfarda3vn72mxz/d/sc6a39p3my8k3uw8",
    launchTime: 1644249600,
  },
  "0x1d596d28a7923a22aa013b0e7082bba23daa656b": {
    borrower: "almavest",
    name: "Almavest Basket #5",
    category: "Global multi-sector loans",
    description:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses.  This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines, and other markets. The security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares.",
    highlights: [
      "Selfin, an Indian lender that provides small, medium-term loans to MSMEs in India through a distribution network of financial advisors.",
      "Upwards, a consumer lender which, through its mobile app, offers personal loans to salaried employees  in India",
      "Impact Water which supplies over 30,000 schools across central and eastern Africa with systems that avoid burning fuel to make water safe and potable",
      "Greenway Appliances, a leading clean cookstove supplier and distributor, with hundreds of thousands of rural customers in India and Africa",
    ],
    icon: almavestLogo.src,
    agreement: "https://docsend.com/view/r9dpyy8wqxp2n5td/d/k87sbpm4ny3s23y6",
    dataroom: "https://docsend.com/view/r9dpyy8wqxp2n5td/d/k87sbpm4ny3s23y6",
  },
  "0xc9bdd0d3b80cc6efe79a82d850f44ec9b55387ae": {
    borrower: "cauris",
    name: "Cauris",
    category: "Global multi-sector loans",
    description:
      "Cauris is a credit fund created to bring decentralized financing to fintechs in emerging markets. This facility will be used by Cauris to provide debt capital to vetted consumer and SMB lenders in the Global South and Europe, who pledge well-performing loan portfolios as collateral.",
    icon: caurisLogo.src,
  },
  "0xf74ea34ac88862b7ff419e60e476be2651433e68": {
    borrower: "divibank",
    name: "Divibank",
    category: "SMB Loans in Latin America",
    description:
      "Divibank will use proceeds from this pool to grow its customer base of online businesses in Latin America. These businesses span many sectors, including SaaS companies, edtechs, and fintechs. Unlike the slower and more expensive capital from traditional financial institutions, Divibank's non-dilutive financing allows these businesses to grow on their own terms with access to quick and affordable capital.",
    highlights: [
      "Divibank's portfolio is growing rapidly, and the company increased it's financing volumes by 10x in 2021",
      "72% of new loans are made to existing clients, demonstrating the stickiness of Divibank's product",
    ],
    icon: divibankLogo.src,
  },
  "0xaa2ccc5547f64c5dffd0a624eb4af2543a67ba65": {
    borrower: "tugende",
    name: "Tugende",
    category: "Asset Finance Loans in Kenya",
    description:
      "Proceeds will be used to fund the growth of Tugende's operations in Kenya by providing asset financing to motorcycle taxi operators in the region. With over $50M worth of motorcycle taxis already financed in Uganda, Tugende is using the same technology and customer-centric model to serve operators in the Kenyan market.",
    highlights: [
      "Tugende have financed over 52,000 clients in both Kenya and Uganda",
      "Tugende have financed over $50M worth of income-generating assets with loan loss rates under 1%",
    ],
    icon: tugendeLogo.src,
    lateFeeApr: 0.02
  },
  "0xd798d527f770ad920bb50680dbc202bb0a1dafd6": {
    borrower: "quickcheck",
    name: "QuickCheck #1",
    category: "Consumer loans in Nigeria",
    description:
      "Proceeds from this pool will be used to scale QuickCheck's operations in Nigeria. With this capital, the company will grow the loans issued to its customers - primarily middle income individuals and MSMEs in the country.",
    highlights: [
      "QuickCheck has borrowed $1.45M from the Goldfinch protocol across three borrower pools",
    ],
    icon: quickcheckLogo.src,
  },
  "0x2107ade0e536b8b0b85cca5e0c0c3f66e58c053c": {
    borrower: "quickcheck",
    name: "QuickCheck #2",
    category: "Consumer loans in Nigeria",
    description:
      "Proceeds from this pool will be used to scale QuickCheck's operations in Nigeria. With this capital, the company will grow the loans issued to its customers - primarily middle income individuals and MSMEs in the country.",
    highlights: [
      "QuickCheck has borrowed $1.45M from the Goldfinch protocol across three borrower pools",
    ],
    icon: quickcheckLogo.src,
  },
  "0x1cc90f7bb292dab6fa4398f3763681cfe497db97": {
    borrower: "quickcheck",
    name: "QuickCheck #3",
    category: "Consumer loans in Nigeria",
    description:
      "Proceeds from this pool will be used to scale QuickCheck's operations in Nigeria. With this capital, the company will grow the loans issued to its customers - primarily middle income individuals and MSMEs in the country.",
    highlights: [
      "QuickCheck has borrowed $1.45M from the Goldfinch protocol across three borrower pools",
    ],
    icon: quickcheckLogo.src,
  },
  "0x3634855ec1beaf6f9be0f7d2f67fc9cb5f4eeea4": {
    borrower: "aspire",
    name: "Aspire #1",
    category: "SME loans in Southeast Asia",
    description:
      "Aspire is a modern bank for businesses in Southeast Asia. The company provides businesses with seamless payments, savings products, tools to help teams manage their finances, and a range of credit products to help businesses grow.",
    icon: aspireLogo.src,
  },
  "0x9e8b9182abba7b4c188c979bc8f4c79f7f4c90d3": {
    borrower: "aspire",
    name: "Aspire #2",
    category: "SME loans in Southeast Asia",
    description:
      "Aspire is a modern bank for businesses in Southeast Asia. The company provides businesses with seamless payments, savings products, tools to help teams manage their finances, and a range of credit products to help businesses grow.",
    icon: aspireLogo.src,
  },
  "0x8bbd80f88e662e56b918c353da635e210ece93c6": {
    borrower: "aspire",
    name: "Aspire #3",
    category: "SME loans in Southeast Asia",
    description:
      "Proceeds from this pool will be used to grow Aspire lending operations in Singapore, Indonesia. Thailand, Malaysia and Vietnam. Aspire provides finances to SMEs in these regions through both its credit card and working capital products.",
    highlights: [
      "Aspire has borrowed $2.45M from the Goldfinch protocol across three borrower pools",
      "Aspire provides up to $300,000 it's SME customers for a variety of use cases including e-commerce companies, solar energy developers, furniture manufacturers, and many more",
    ],
    icon: aspireLogo.src,
  },
  "0x1e73b5c1a3570b362d46ae9bf429b25c05e514a7": {
    borrower: "payjoy",
    name: "PayJoy",
    category: "Smartphone financing in Mexico",
    description:
      "Proceeds from this pool will go towards growing Payjoy's lending operations in Mexico. Using this capital, Payjoy's finance the purchase of mobile phones for their customers, and be repaid monthly by these customers with interest.",
    highlights: [
      "Since its inception, Payjoy has served over one million customers profitably, allowing these customers to acquire smartphones on credit",
      "These loans are backed by the financed mobile phones, with Payjoy making use of phone locking technology to keep default rates in check",
    ],
    icon: payjoyLogo.src,
  },
  "0x67df471eacd82c3dbc95604618ff2a1f6b14b8a1": {
    borrower: "almavest",
    name: "Almavest Basket #1",
    category: "Global, multi-sector loans",
    description:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses.  This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines, and other markets. The security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares.",
    highlights: [
      "Selfin, an Indian lender that provides small, medium-term loans to MSMEs in India through a distribution network of financial advisors.",
      "Upwards, a consumer lender which, through its mobile app, offers personal loans to salaried employees  in India",
      "Impact Water which supplies over 30,000 schools across central and eastern Africa with systems that avoid burning fuel to make water safe and potable",
      "Greenway Appliances, a leading clean cookstove supplier and distributor, with hundreds of thousands of rural customers in India and Africa",
    ],
    icon: almavestLogo.src,
  },
  "0xe32c22e4d95cae1fb805c60c9e0026ed57971bcf": {
    borrower: "almavest",
    name: "Almavest Basket #2",
    category: "Global, multi-sector loans",
    description:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses.  This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines, and other markets. The security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares.",
    highlights: [
      "Adelantos, a Panama-based fintech lender that provides loans secured by mobile phones to individuals across LatAm",
    ],
    icon: almavestLogo.src,
  },
  "0xefeb69edf6b6999b0e3f2fa856a2acf3bdea4ab5": {
    borrower: "almavest",
    name: "Almavest Basket #3",
    category: "Global, multi-sector loans",
    description:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses.  This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines, and other markets. The security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares.",
    highlights: [
      "Selfin, an Indian lender that provides small, medium-term loans to MSMEs in India through a distribution network of financial advisors.",
      "Upwards, a consumer lender which, through its mobile app, offers personal loans to salaried employees  in India",
      "Impact Water which supplies over 30,000 schools across central and eastern Africa with systems that avoid burning fuel to make water safe and potable",
      "Greenway Appliances, a leading clean cookstove supplier and distributor, with hundreds of thousands of rural customers in India and Africa",
    ],
    icon: almavestLogo.src,
    agreement:
      "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/a22b60ac-89b7-4184-a6ba-3ed16c45ab8f/ALMA_Goldfinch_Protocol_Loan_Agreement_FINAL_%288-30-21%29.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAT73L2G45O3KS52Y5%2F20210831%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20210831T000715Z&X-Amz-Expires=86400&X-Amz-Signature=01c8b63f01e46afb753c4f37ba75836b0743fa8e82ce94fbf32aefbbad367e6a&X-Amz-SignedHeaders=host&response-content-disposition=filename%20%3D%22ALMA%2520Goldfinch%2520Protocol%2520Loan%2520Agreement%2520FINAL%2520%288-30-21%29.pdf%22",
    dataroom:
      "https://almavest.notion.site/ALMAVEST-BASKET-3-FULL-d65cbcc7cfab4c7ebd6763471fc2a024",
  },
  "0xe6c30756136e07eb5268c3232efbfbe645c1ba5a": {
    borrower: "almavest",
    name: "Almavest Basket #4",
    category: "Global, multi-sector loans",
    description:
      "Proceeds will be used to expand ALMA's pan-regional debt platform across our three investment areas of focus: inclusive lenders, carbon reduction project developers, and diverse social impact businesses.  This includes active pipeline deals in India, Egypt, Indonesia, Colombia, Spain, Philippines, and other markets. The security we take on our loans to borrowers includes overcollateralized loan portfolios, carbon credit purchase agreements, corporate, personal, and/or sovereign guarantees, cash collateral, and pledges of company shares.",
    highlights: [
      "Selfin, an Indian lender that provides small, medium-term loans to MSMEs in India through a distribution network of financial advisors.",
      "Upwards, a consumer lender which, through its mobile app, offers personal loans to salaried employees  in India",
      "Impact Water which supplies over 30,000 schools across central and eastern Africa with systems that avoid burning fuel to make water safe and potable",
      "Greenway Appliances, a leading clean cookstove supplier and distributor, with hundreds of thousands of rural customers in India and Africa",
    ],
    icon: almavestLogo.src,
  },
  "0xc13465ce9ae3aa184eb536f04fdc3f54d2def277": {
    borrower: "almavest",
    name: "Oya, via Almavest",
    category: "SMB loans in Africa",
    description:
      "Proceeds from this pool will be used to provide financing to Oya Group via the credit fund, Almavest. Oya is a Ghana-based micro-lender with a 10+ year track record that supports the growth of small businesses across Africa by providing quick, and convenient access to credit. Oya operates across Africa with subsidiaries in Tanzania, Uganda, Liberia, and Sierra Leone.",
    highlights: [
      "Oya provides loans to MSME borrowers, focusing on small business traders, drivers, and local institutions to support their working capital and small asset financing needs",
      "Oya has to an engaged customer base, with 60% of customers borrowing every 2 - 3 months",
      "The company's borrowers are 82% female, and made up mostly of young individuals, with 66% of customers between the ages of 26 and 55.",
    ],
    icon: almavestLogo.src,
  },
};
