import {CreditLine} from "../ethereum/creditLine"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {TranchedPoolBacker, TokenInfo, TranchedPool, TrancheInfo} from "../ethereum/tranchedPool"
import {parseBackers} from "./parsers"
import {BlockInfo} from "../utils"

export const PROD_BACKERS_ADDRESS = [
  "0x00000000cc0b822819f03424dacf9077fdaa58a3",
  "0x0161d1cc10116bb2a073a0c293d5e4f1a97a00b6",
  "0x0196ad265c56f2b18b708c75ce9358a0b6df64cf",
  "0x02483ab8b7eb1804db8da2b734a15f5813615f85",
  "0x033cfb92e4f0e466ab4dbdce7eac50a90b3abda6",
  "0x03c71ab47ad0263f57f274e1094a50b74c10f934",
  "0x046f601cbcbfa162228897ac75c9b61daf5cee5f",
  "0x0544c10cf254eede9711b9fb6cc803ff3c3bb628",
  "0x0773a995e752eec6456ae887dec5d4e06479fa9c",
  "0x078b8ff955e3cf77550bf2f2edfc0aacbc29adc6",
  "0x07f82cea5770723207f8544a00023deb8968755e",
  "0x08e89248c86fbfddc30ab8130e136d2d66600a12",
  "0x0960da039bb8151cacfef620476e8baf34bd9565",
  "0x0ad4070e1c34e0bd2f6366cfb8f71d566d1bd89f",
  "0x0ae9b28ccbe5cfe2bd4e6731392441023c9d6cb9",
  "0x0b0acdd302e39e6c1549b1698150df4409b2a7ac",
  "0x0b4ecf28692614c10deb7d8579f4878be3fd2de9",
  "0x0d1b8a36d4b791dbf84ef5a769ded0f738611d95",
  "0x0e63ee1a039bcc422b1baaf65c7ae30c497d3fc8",
  "0x107cd74419dfc9ff01975e652597c5a4b6706460",
  "0x108bd550a888b6174b7bb2f555fc4006b1853984",
  "0x10a590f528eff3d5de18c90da6e03a4acdde3a7d",
  "0x10f6d0f06f6f53a573ca572ddc4852f21859577f",
  "0x111b46bfae308be4570cb9f17d051b58022d7c89",
  "0x12346f18481852c70f6f03deb13e050c7d4eaf90",
  "0x12ac1c9d14576a47453c006c1f72228600ebfc09",
  "0x12c444593336f75f42e83b6fdc833607d21b943f",
  "0x13b91b3ff58886ace7637e547c53bbc2936d803f",
  "0x1426d2146c7477c404a8434b94eecf0e1c1580b0",
  "0x14ff0bc9417b6796f79768729002a793b51205b8",
  "0x161619839ebbada5d3c279e1a79c50f7fc4274d6",
  "0x167e95bb2a0bf1201a8bef7b908629091102e9e7",
  "0x1755cff12a88289f2a884a240e5b1b58ac3a0e58",
  "0x1795dee42dec2705f7a228fe0e62cd0a143a8de3",
  "0x17d60e33385700247741d8a0c2db0d4ac28130d7",
  "0x1905547149b8c192fba7a42e8c6a7bdb3ba3807c",
  "0x1b26be686022d3964a521c53c0973434021a72ec",
  "0x1b87b6ef6de51d272bd30493d0761d9a8de6b3d0",
  "0x1bdca6a46d69efe0b4c7b1ac962f240e0e1f040c",
  "0x1c2cddc58eae7a9d6cfd2aa7b8ed7ddad9900179",
  "0x1ce606d6ac53866c7be4f3dbb8ac0e991bbbe614",
  "0x1d082f295ad54f472824a7f3b01fd2d29a05833b",
  "0x1df4c04d9c4247bedf051e73730c46a03c3d3050",
  "0x1e5d6cfb3eeac9c21065296927bf4d155b3d64c8",
  "0x1f9e539d76ecc21830fa6a7cdea4cf3946927a04",
  "0x2031cc88e566e08e7cbd0b8363d36a4141731503",
  "0x207b94b7dac8203e2fad3f0866385b5c187b73a3",
  "0x20b8f57cf7499cb448b25aec4ee02a8a6fb7c6d7",
  "0x225c4cfc17d5ee7bf3e682396b12c0f6a7709d7d",
  "0x23542be43939d943b7aba65514faef11e1f61ac1",

  // "0x24710bdfbea631d9d11eed0aeebfd49fd8e5ff70",
  // "0x25981b976cf3d0311943575981e29ac9fd9e8999",
  // "0x25fb88e70f420addb51f9a99b484be66dfbea327",
  // "0x263de256b8fdafed8ba91368b461f659bb916061",
  // "0x26506afe2809266719e8557d3fdd4a0359295a7e",
  // "0x294388d7f62065784666f797ca6919a4b8cef4ab",
  // "0x298c7de0abf45aa9290d77c1f77b4d2bd2472f0a",
  // "0x29c45ff4e5c6e6f99a4110f56db8327563af69a7",
  // "0x2a98f5b29b205f9f18c7731486096516878589ed",
  // "0x2b2b7fec2ba5854aef243c21a583d8e61ee82c32",
  // "0x2c3f500d7b743eae6a41831184ff1caae951ea12",
  // "0x2ca4425a257e770a21b3f604d7c52b7c1239def4",
  // "0x2caf97331ffa906b8080165996fe57c6d5eac986",
  // "0x2d63f94b6b3f5859dcfde3baf6e2b4743e81c1bd",
  // "0x2daccec87c9c05daf1ebffaf18c4d1f84d165e1b",
  // "0x2e2dbfeb78aed1b732b433c91fef53e90838865f",
  // "0x2f2588acd44253312b4a94bf6753be67514a5cc6",
  // "0x2f500cb2d7df0dd524f6933133cb21fce93bd41d",
  // "0x2fea4863082ad91979aa8c011048ba5f3ea2c3fd",
  // "0x300cf71ef3f5443bd92f24e86fab1a945eee3461",
  // "0x30bf85e1d0bc7fdedcbeeff39225d8037cb0cb7c",
  // "0x30df16cd7d612c5b25beb0331486b127a42ac371",
  // "0x313867f1ee7efa752f85f33b2e7b558736353228",
  // "0x31a79c7f44820161c645115bbd2ce96be9336b3f",
  // "0x31a82735012c638e998d831c07dff52de1049adf",
  // "0x32596cadecfbce13d3dd68864135e8876c9cd8b6",
  // "0x346f1b35cd74080b0d2001ad99d4ff3f06b28631",
  // "0x34bdab3042cfd0614658b2e1da368f8ca484929a",
  // "0x352a45cc1aa286c643a9471a04435dd88a027d88",
  // "0x360f9f42411b3355bc448a28f1b399f2718a9363",
  // "0x36e36ca99218d21b444b5068dc6ed0c907119651",
  // "0x36f26e2e5bed062968c17fc770863fd740713205",
  // "0x377af2d92f7e09009847a38cec9b35d5fc95bd35",
  // "0x391985fdf0f28de092027d52763621221684cadf",
  // "0x3939d22af089bdfbb96322744234f69db1ab52f8",
  // "0x3b21b13b99a903c37b62001d63864cb405f103bf",
  // "0x3b2f7dfb30ff05857351de1c14fff290f4384c9e",
  // "0x3d8ef995a36965f17b4461848a8fbe92789a18db",
  // "0x3e7ea126d6aaae70f5a1bb2bbdf4c321e0fbaaf3",
  // "0x3ed23d80c7b9e3a159316b3f47bbdab738ba893e",
  // "0x3fe72b97b562b5a7fb2b1c86060912da30d218e3",
  // "0x416e367b6dfa99b04bd38fb3725c78abb7132429",
  // "0x4213d9b38356c1bb9f552889bd5f05c36946173c",
  // "0x42d4643b9e893e8af5144138bb22144ba3f4dd6a",
  // "0x434a316b54a1a45d02524f0a8bebf8a27c3ec715",
  // "0x4679c6a025c3385e6b842dfa7a3d2831fa3b1ac5",
  // "0x47547895218274e121e4219a3fd23235377a9903",
  // "0x4902b20bb3b8e7776cbcdcb6e3397e7f6b4e449e",
  // "0x4b05acf4d3612e9b0d01a9275243b81d132a71d8",
  // "0x4bc496f7b1806a46aa048b97fdc180c0c79ce29d",

  // "0x4bcdbebbf5253850d8ffc3137d2475670e09732a",
  // "0x4c17cc6b4d65b5fdb81032b0faaa42b28a6abe1d",
  // "0x4c6bb92f83e0e978270e8325181adee3f1d0df7f",
  // "0x4d2ed284cb9ebaab06bc01cc1c7f824e5b161378",
  // "0x4e07ebb283634233c2348ec7bb059995e6553da6",
  // "0x4f95ad114fbddf8df0756017e9bc856e730b2796",
  // "0x4f9eab0394e41fc5d43f3bf99e92148399da77a3",
  // "0x50693e63a0abb825b1ba99564954d45b6e45a632",
  // "0x51102afca1fb28c349359643e2a28d8e40b97b8b",
  // "0x526c7665c5dd9cd7102c6d42d407a0d9dc1e431d",
  // "0x53bad4e06b7b0244927bb03d43f3171c4b0349be",
  // "0x5550d9f1d786f5e0f32470d8f333181930e4b55c",
  // "0x5584cf54ade7c81ab6d6bc870c714f87fc0a7721",
  // "0x55aea4cd456478d56f598e06a0db228192d5eb84",
  // "0x560fefc8f45b8d43f86f79f718dd0364d42037bd",
  // "0x56f8b7e289058ff2852e8a1e925655eb442631af",
  // "0x5725a458b319d73b8ec84c47de80620e7b191b0c",
  // "0x58507cd924340530cbea0883786396e1e9b2c0e3",
  // "0x59a9a5561d6b863762cf29d45d899c57b1ae5a6c",
  // "0x5a27d268e830655e908a0a2c3b24f572695af5e8",
  // "0x5a756d9c7caa740e0342f755fa8ad32e6f83726b",
  // "0x5b191f5a2b4a867c4ed71858daccc51fc59c69c0",
  // "0x5b4b0e98864f21650fc14e529785e925f05089fa",
  // "0x5b4e28133aab99ee9fc77b649127a6cfacf28793",
  // "0x5c780a9b51d8358b230c4c92342cb57b1bcf1900",
  // "0x5ddfbfe0d816f182739c03137c19da4d16af3820",
  // "0x5edf60c9dc63efa6b9cd41d0aed34ea1c7e7f603",
  // "0x5fcd8118adcb4ce6e08cd745ec7c22a8ffede3f0",
  // "0x6112285c73c8385defb50bee179573661084271e",
  // "0x64cee4d9d5f4f7a231dd53d48c1d19bebd71dbe0",
  // "0x64dc694344f9cc7635bc6c821499f05bbc4a700f",
  // "0x652b94ddfe2bbfb905191821369bb9f0861ed343",
  // "0x65685914465e7f6e70624b8bbd1c66be0411923e",
  // "0x6709a89090732f5695aa07ea29fb7318aa08e895",
  // "0x68476977382d9cb85d11775b79252ee7d2859738",
  // "0x6909087e694a492bf3d010dbc065515ef8438057",
  // "0x6a5dbf2fb5206ec8192620810c3edb6d5e62b188",
  // "0x6b6608c001fe77b5bb13e57bc64356dc95385a52",
  // "0x6b970cd93b6139ac830d966e2fe94cf81653479e",
  // "0x6bf32be85a8d6893aeb618a7fd091f6a70745f33",
  // "0x6c648fd0f179c567b3ef635fd204df74baca1da4",
  // "0x6cf6d7c4b21e01442276a37fb21666b08c8e6d32",
  // "0x6d3c4171d6807378cf6482732873e675d28a8c72",
  // "0x6df98185315270b653889c796509cbf7b943b9aa",
  // "0x6dff64676cbf88ba26f1b5b2c5fcccb0c638e3d1",
  // "0x6ec925cf05a9c2d0547cac7393184dad4942e579",
  // "0x6eff23b65688cae71af19128a7674b7dd53f7f19",
  // "0x6f9bb7e454f5b3eb2310343f0e99269dc2bb8a1d",
  // "0x6f9eff4d554e82dc72fa55465ff04b28ea1c09ce",
  // "0x728a8ab23f29679d2aba7e63acd5144e42e91c81",

  // "0x73046a85c4de379c8849ffeafb2a1892793aa1da",
  // "0x75721af9fdabe9e0bfb960dee66fa287a20a085f",
  // "0x762a91ab7615e306547e2dd1385693dacb0809f5",
  // "0x7867c5f717a833f9c29790b3424e69f8c1d164fa",
  // "0x787af2e1ef868ac9d2cf3e659112bbe173c04c87",
  // "0x792a97fbe51ac086360021117f403954291ad332",
  // "0x7a86c44e1b41c6c37ff783e8f6b2f6c68ab251f4",
  // "0x7ab19ab563ec3e0aa8f2e283513286a58d3a4ae0",
  // "0x7c712ed41cf47f9bbc9f6e8d2e59ae8c9d3ece11",
  // "0x7cf20a1bb4cae92df714eaf760814860ed5f785f",
  // "0x7d81ad6708ae8aba7568edc1b3b0d3554ec7b248",
  // "0x7db4f8603483860df860873ea5ab5d818a4511b1",
  // "0x8100311305c9f81330d23c33fd9f6ff0093d12d3",
  // "0x8140b5d041490a706da799dd295dbb251b3fbc7a",
  // "0x8149dc18d39fdba137e43c871e7801e7cf566d41",
  // "0x830eb974d66829dab458cba37944b4afe7a0f409",
  // "0x83463f91bab2062d26d5d83080295a2ded377501",
  // "0x84c697eaf77deb3b8ba24b8056a1bf27838c5cb5",
  // "0x850d3158d7bd0090b1c12d800c9e0ecf6410c846",
  // "0x86515e78e4300f46af86d9b204170d51aee6ad91",
  // "0x87dbec2d97c0e2025b1cc64a9d527a2995268bcc",
  // "0x8874470f7a5a6485ad1abf163399bbed0eacc663",
  // "0x8add019084c54441669ab178f29e614d4d1b9cdd",
  // "0x8b0a7643f7a880cb635a5ed1ad96817c6eb39800",
  // "0x8c36bac08938663fd0c79dc420adfefb6f06119f",
  // "0x8e4b8a2c6fb0d54a5469cf297ee7747e425fe0e8",
  // "0x8f3b566f10db11b682942dbda74f90279104d0a1",
  // "0x8f95adb1e97fdb9015806acbbad5becc818bed5d",
  // "0x8fc3d46525daf94552c464ac5b296661ec78b428",
  // "0x90681d5efa80999e7e9259e9f708dae20b169966",
  // "0x9125147895d5cca9b75db073fe9edaacff5b2b23",
  // "0x92b52e6441a9e2e03d080e951249d93df222f855",
  // "0x93349626f432ff662baf53e649783c0e95e29fb0",
  // "0x937f250b6ae6dd9eb8bd8b86f4b9796b6ef05d13",
  // "0x94a5075637ed4d3bbd7945176cec94c739ba9c7e",
  // "0x95f3537d482c6641ff494cd3c8e6e958a9daa016",
  // "0x9688e30e7a78a7fb2ec28ec492194120beed5942",
  // "0x96aa014bcd98990df0652c0393525d11a1da0d85",
  // "0x96e0fc56fde665f3145ba1d8a105ed82df6b99ce",
  // "0x9704f55aa24237625f4a23a0ac2b31a9cf22fab8",
  // "0x984253cad96157b89255f4674e5362fc0feb69ee",
  // "0x98b267c74728e49fd14bdeedd7e08f6c610be38a",
  // "0x9a568bfeb8cb19e4bafcb57ee69498d57d9591ca",
  // "0x9a72b97137065b3816d091310e483811baa1be0f",
  // "0x9b1aec32d465fdaf78199860aef660ed6ca5a2b6",
  // "0x9bde6630773bdcaf111f1cc6cc6e405cfa1d8834",
  // "0x9c6752e8f7f72654740193061baad24e749c48e8",
  // "0x9debadcaae4820092c8ff7dc741c9ec7d9e95027",
  // "0x9e817382a12d2b1d15246c4d383beb8171bcdfa9",
  // "0xa05967ed87d17ac0978101b73cf784573a801be7",
  // "0xa0eb86bbfabac782b049ac97285a40b23fb30386",

  // "0xa1457afa30b8e396cde5bac320ed7c8e7b521bc8",
  // "0xa223c7692d7a80c98a94ce0f2ac19dfeb8fd47ca",
  // "0xa231a5ae629a0f15e1c1eb3ffbf813589e206926",
  // "0xa2dd0ed4c27b27e6dbf4d1e07c956599f0251b81",
  // "0xa32a9012c785e945ba7e64d79405e80982b68bf5",
  // "0xa3da7b05bf56a6b090f21b0513316851ddf839a8",
  // "0xa3deb012dca06b12a7e9ae06738fccb4d39a6324",
  // "0xa462abc1d228bb7122c7a80d92b721d2bae9a8c3",
  // "0xa652f1e216e881b3a679d91958a5e93c71828ca6",
  // "0xa70e6fe4488104be32b9b657f5be7b68afc17f9a",
  // "0xa7c865d8dc45f67eebea6d994cd95a765cdd802d",
  // "0xa7f2dfef34ed820aa790ce55e26925fd5a916d99",
  // "0xa832146bf5d44e7ef19ab9ad7d2397cfad0ac53e",
  // "0xa8d5040bf6d02be09df157c3d8777dde21ee9690",
  // "0xa911ccf5f6c7bd5fb25188d41a536890c3c8fae5",
  // "0xa9415413f979f25277792d4991212336bcbf6c6b",
  // "0xa9da96fdde324a1471e7fafa86c8ede51b3cd617",
  // "0xaafb94437fd74bf39563912218fdbde3e37e2ffc",
  // "0xac5b6d6b47f5d68f7daa1036fe73c844eb954334",
  // "0xacdcd97bf83eb1ad73a143edc70ee3d4510ea728",
  // "0xaedf1286c19984bd4b96eaec9e3c54872f9e6fb2",
  // "0xaee76d8c25893cdc8ba659b6f89a304e2208f234",
  // "0xaf2a082188ad55993c0fbf1e067c01f27cc69e1d",
  // "0xafa78d6e24101eb874333549a87f46629c94b759",
  // "0xb005bba8414285450b44841267946cdcc3943498",
  // "0xb0ba26dedc9c1ddae319de606c3b1279e26be57e",
  // "0xb39fbb76e7677ff97397a1683d01f04df4cfed82",
  // "0xb4522eb2ca49963de9c3dc69023cbe6d53489c98",
  // "0xb4627d61be6916ea2faefffaad1f333b5af39914",
  // "0xb478ab91a9faa7cc8503d85dc8ef35ba4bbcb45e",
  // "0xb512f6eda8d66092c5ab1d6c5ec718970e064683",
  // "0xb52d1d3fa331c1d568028a5438e1ea20d69442dc",
  // "0xb5a790758cdb6644305d1cf368b67bbba4c9a68c",
  // "0xb635fa1a4e7f1f2edf5fbe4630040cb6db0b40af",
  // "0xb6605f98a5562b1ac821bc5f2b75934239e8c6d6",
  // "0xb69bcdd524fa3ffa0549b3b1d15efa94ad26c42a",
  // "0xb777320f051877411e70cce1418edf5ee46d7c02",
  // "0xb9df1ac065aba19fb4a23328784665b9b19dee31",
  // "0xb9fbfc908ceb29d605aed9a56dcfa43cfb057582",
  // "0xba181deb98afc2202202c9aebf26b18f46d70497",
  // "0xbaf0ce3ed7888ab21e028ca421664f7b6c8a3eb2",

  // "0xbb34666407e47f87a44e4540ee765909506cb105",
  // "0xbb4615d7223cbc087ced0d32bc2f1862cb91b6ad",
  // "0xbc79501610c5ba40959d5fcb9aadf743c86ba7d9",
  // "0xbcf3be746dcce9c9b1e87d7a03ff199f9ac7eb9e",
  // "0xbcfa2af958da435e1dfb2338518e423ad701f7cc",
  // "0xbdcbae4c1879621d12c73f93b9788f8338860e9d",
  // "0xbdf4cf8269c3883dd88975e1978a6aa9d3877f2e",
  // "0xbfe98ba61eb224f657d392333f213f6d75cc6972",
  // "0xc041652a65456147b33843aa7ba44fa8dc3523f9",
  // "0xc246b4dbdfd51637887a8b55685b54fbe253dd9b",
  // "0xc32b7438b3df7844c9ee799930a2224fe6e26426",
  // "0xc332f7d5bcc09ca423d88a3fc1b6694474a455ac",
  // "0xc47145a82f21c5bb731e0dd419a668a5014a7037",
  // "0xc47e00aeb69c3fbdb79201270ded5a5066832a81",
  // "0xc5467213593778e528f0eb8117cc7afbc5b7491b",
  // "0xc60861680f748fb8164e392dff70ece0577b4389",
  // "0xc70aa0bc5c372ca2006204c91af480dacf621bac",
  // "0xc85b28a821f29bdda4413be8f2f3e71f1f69f6ee",
  // "0xc8d46eb7881975f9ae15216feeba2ff58e55803c",
  // "0xc8dd81e7319339326b95fa16a43e19f4b295ac1e",
  // "0xc8fd7c330e31f2635f4a67790f391edf2e493ddb",
  // "0xca86832b1323cba5f6ca156d667e4e26d3f20f10",
  // "0xcac59f91e4536bc0e79ab816a5cd54e89f10433c",
  // "0xcada38b3d2e3d8714e783ae8c420b4024817e3e8",
  // "0xcb0a2dbb9da3f6228255510df572cb5634cfdaef",
  // "0xccf9a2f4b558d0a23d2f678adf2de1dc52fa343e",
  // "0xcecdc196b88c71e93de12f2643cc00573a6bff2d",
  // "0xd024806f7bc1fe044db4e1f42ddc73674c1d0903",
  // "0xd04af0d9d6c89533f3b6a02dd8cc4d12a1bf12d9",
  // "0xd144992c2906b7ccb810a09d91c528cc4d32934c",
  // "0xd21d931890d27b6e7e2e668f27931e17698e90f1",
  // "0xd3aecf9e0856822bd320873e905ae9f78a2977e7",
  // "0xd3f89f4c519b06281767fad82a84be7607998df2",
  // "0xd4abdde483bc424ab77916612850e9a30220918a",
  // "0xd4d00a14d2d3181dbebeaf062933d150e9bafb27",
  // "0xd4de9f0fa7c40853146ad4994bb3a52615ffdb40",
  // "0xd54809ece97a0a0956bdd73650530ffbc825161d",
  // "0xd5a41bfe8e373c94434eab2fc81034ec00572b09",
  // "0xd5e089906d0c759f27403f3db7ae76007ca09dad",
  // "0xd6085929281bb484763ca58cb06690e4f457d171",
  // "0xd6884f50113e87184a24b73422feef9fab6047d7",
  // "0xd6b01c20918a7ba5d05e81dc59ded322962b4d37",
  // "0xd73f607911967e716e9c275e71831d90c22e9bc2",
  // "0xd8ce05227a1ca1ac606aa7b40a76885e8bb56eed",
  // "0xdb86b02928c47cb1c1d231b21732e6c639b28051",
  // "0xdc4f707ea3b9d7b66f4c45466b6f99eb2f6b9b86",
  // "0xdc509d0334c1f6a47af914e222391b0639a211fb",
  // "0xdcd219c85863fc8eecd8b743faabfc6de234c578",
  // "0xdcd7d160815a1c256ddc73b3faa89391114d8249",
  // "0xdec2216fcbf07810d29f25c439ba6214436c4f36",

  // "0xdf632ea5ba8283488aae8538e17a2f802243a61a",
  // "0xdf839bbbe062ae73493a6961fc34849b53f1c154",
  // "0xdfac48ba52da464cdbff2f67849784384b0e874e",
  // "0xe11bb2df7f004f190f75e6ec77528cf30b6afbfb",
  // "0xe16843c04f25b559cfb34ecf160063e0d71208ea",
  // "0xe28f4d644942159dd5b46d17f63e2b142ae70ef9",
  // "0xe3b62d868904c93f32718f54ab64bf4f3d1f4635",
  // "0xe539cd6f9db04fe3c40ff4a1c24a7453e7cf265d",
  // "0xe7162c0b3902d8122f8e9792f314b972075e6ce4",
  // "0xe7738f1faa18b5008b967cf59e1a7b2e07a8bb0a",
  // "0xe80271fc093d8d19e97f0d5820f0e3cfe0e44887",
  // "0xe8d223d240007106b390bb549b67b8d45cb5143d",
  // "0xe9017c8de5040968d9752a18d805cd2a983e558c",
  // "0xea6207d0a53a8d4834c5e889e53c1acc1fe52bf3",
  // "0xeb1346bb4a15e5b6923e7c002fb4d09ea98a04a0",
  // "0xecb98e3b08ab27c6cb21e0c2a90dcd07b35c129c",
  // "0xecc03538d9af264725dabd36417441f7971c91f6",
  // "0xecd02810db92ff027ea1b0850d46bda963676d74",
  // "0xed06c50bb6f49edc029803d16fec26ab7f640a08",
  // "0xeda7464376d91a614a9267e786e2da1f77c7921e",
  // "0xee5894bb440342457eea42e46d6af75bedb14805",
  // "0xeeda7f71df5a589a9b8c5794aa3d28d66a4ee672",
  // "0xef89e95c889f349f8ae3c226d87c94a96f6a9bfc",
  // "0xef8ad98bf43063ebe669576b08e1a05519e302f7",
  // "0xf18f071781689b1f5e5be800cf6b1aba7d46bc32",
  // "0xf212ce21a97dbe30999a4c2b309d278bccbb686a",
  // "0xf251d6d81d2ca39c092ddf6a3374a62b85e7471a",
  // "0xf3afc2383a0b45ae73d77b49df7f2184b1ad4b90",
  // "0xf3d7459c7f6f75252aadf594d2ea74f04b359f82",
  // "0xf4f16c2fc1d162c31c80ff31008e4a3a23bf4281",
  // "0xf627e5f4bad95a956468d8bb6ee20b119f992e96",
  // "0xf64516c7a669d1dd131a32526927c60d171e0321",
  // "0xf78f2bba5ea14419ff7cb5e68d192cd214ec049e",
  // "0xf846638aab987d031c79bf12703500d8bd5963a4",
  // "0xf8a63c05eb4820d4a582f45642077e13f6f8a549",
  // "0xfabb4f3885a013b4ab1f20414038a265dd6be647",
  // "0xfac764f39866e52465cf3d1fe8a959a3a9fc6d27",
  // "0xfb40932271fc9db9dbf048e80697e2da4aa57250",
  // "0xfb892ca235a9fbbcb6dcd808b151f08a712f2f36",
  // "0xfbaabbe9aecebff17b0da14bc5d0d283ed99c79f",
  // "0xfc3551f3b51f27ca60efb25f45ed95d4e80e7071",
  // "0xfcba0693fc16dcb2a4e8fa7ed3da31f5296993e4",
  // "0xfe441ae7f0521386400ce132434e17bb24e8aee9",
  // "0xfe69842f9cfc9f98aea85525bf7360a87863244d",
  // "0xffd92144cafd599a5a93e4805ca4d8f0e666d623",
  // "0xffe885e77fd52cc2821ad2b7eef0051c53f4930e",
]

function validateCreditLine(creditLine: CreditLine, graphCreditLine: CreditLine) {
  if (
    creditLine.address.toLowerCase() !== graphCreditLine.address.toLowerCase() ||
    !creditLine.availableCredit.isEqualTo(graphCreditLine.availableCredit) ||
    !creditLine.balance.isEqualTo(graphCreditLine.balance) ||
    !creditLine.collectedPaymentBalance.isEqualTo(graphCreditLine.collectedPaymentBalance) ||
    !creditLine.currentLimit.isEqualTo(graphCreditLine.currentLimit) ||
    creditLine.dueDate !== graphCreditLine.dueDate ||
    !creditLine.interestAccruedAsOf.isEqualTo(graphCreditLine.interestAccruedAsOf) ||
    !creditLine.interestApr.isEqualTo(graphCreditLine.interestApr) ||
    !creditLine.interestOwed.isEqualTo(graphCreditLine.interestOwed) ||
    creditLine.isLate !== graphCreditLine.isLate ||
    !creditLine.lastFullPaymentTime.isEqualTo(graphCreditLine.lastFullPaymentTime) ||
    !creditLine.maxLimit.isEqualTo(graphCreditLine.maxLimit) ||
    creditLine.name.toLowerCase() !== graphCreditLine.name.toLowerCase() ||
    !creditLine.nextDueTime.isEqualTo(graphCreditLine.nextDueTime) ||
    !creditLine.paymentPeriodInDays.isEqualTo(graphCreditLine.paymentPeriodInDays) ||
    !creditLine.periodDueAmount.isEqualTo(graphCreditLine.periodDueAmount) ||
    !creditLine.remainingPeriodDueAmount.isEqualTo(graphCreditLine.remainingPeriodDueAmount) ||
    !creditLine.remainingTotalDueAmount.isEqualTo(graphCreditLine.remainingTotalDueAmount) ||
    creditLine.termEndDate !== graphCreditLine.termEndDate ||
    !creditLine.termEndTime.isEqualTo(graphCreditLine.termEndTime) ||
    !creditLine.termInDays.isEqualTo(graphCreditLine.termInDays) ||
    !creditLine.totalDueAmount.isEqualTo(graphCreditLine.totalDueAmount)
  ) {
    console.error("Credit Line data failed validation")
    if (creditLine.address.toLowerCase() !== graphCreditLine.address.toLowerCase()) {
      console.error("(graph), (web3): id", graphCreditLine.address, creditLine.address)
    }
    if (!graphCreditLine.availableCredit.isEqualTo(creditLine.availableCredit)) {
      console.error(
        "(graph), (web3): availableCredit",
        graphCreditLine.availableCredit.toString(),
        creditLine.availableCredit.toString()
      )
    }
    if (!graphCreditLine.balance.isEqualTo(creditLine.balance)) {
      console.error("(graph), (web3): balance", graphCreditLine.balance.toString(), creditLine.balance.toString())
    }
    if (graphCreditLine.isLate !== creditLine.isLate) {
      console.error("(graph), (web3): balance", graphCreditLine.isLate, creditLine.isLate)
    }
    if (!creditLine.collectedPaymentBalance.isEqualTo(graphCreditLine.collectedPaymentBalance)) {
      console.error(
        "(graph), (web3): collectedPaymentBalance",
        graphCreditLine.collectedPaymentBalance.toString(),
        creditLine.collectedPaymentBalance.toString()
      )
    }
    if (!creditLine.currentLimit.isEqualTo(graphCreditLine.currentLimit)) {
      console.error(
        "(graph), (web3): currentLimit",
        graphCreditLine.currentLimit.toString(),
        creditLine.currentLimit.toString()
      )
    }
    if (creditLine.dueDate !== graphCreditLine.dueDate) {
      console.error("(graph), (web3): dueDate", graphCreditLine.dueDate, creditLine.dueDate)
    }
    if (!graphCreditLine.interestApr.isEqualTo(creditLine.interestApr)) {
      console.error(
        "(graph), (web3): interestApr",
        graphCreditLine.interestApr.toString(),
        creditLine.interestApr.toString()
      )
    }
    if (!graphCreditLine.interestAccruedAsOf.isEqualTo(creditLine.interestAccruedAsOf)) {
      console.error(
        "(graph), (web3): interestAccruedAsOf",
        graphCreditLine.interestAccruedAsOf.toString(),
        creditLine.interestAccruedAsOf.toString()
      )
    }
    if (!graphCreditLine.paymentPeriodInDays.isEqualTo(creditLine.paymentPeriodInDays)) {
      console.error(
        "(graph), (web3): paymentPeriodInDays",
        graphCreditLine.paymentPeriodInDays.toString(),
        creditLine.paymentPeriodInDays.toString()
      )
    }
    if (!graphCreditLine.termInDays.isEqualTo(creditLine.termInDays)) {
      console.error(
        "(graph), (web3): termInDays",
        graphCreditLine.termInDays.toString(),
        creditLine.termInDays.toString()
      )
    }
    if (!graphCreditLine.nextDueTime.isEqualTo(creditLine.nextDueTime)) {
      console.error(
        "(graph), (web3): nextDueTime",
        graphCreditLine.nextDueTime.toString(),
        creditLine.nextDueTime.toString()
      )
    }
    if (!graphCreditLine.limit.isEqualTo(creditLine.limit)) {
      console.error("(graph), (web3): limit", graphCreditLine.limit.toString(), creditLine.limit.toString())
    }
    if (!graphCreditLine.interestOwed.isEqualTo(creditLine.interestOwed)) {
      console.error(
        "(graph), (web3): interestOwed",
        graphCreditLine.interestOwed.toString(),
        creditLine.interestOwed.toString()
      )
    }
    if (!graphCreditLine.termEndTime.isEqualTo(creditLine.termEndTime)) {
      console.error(
        "(graph), (web3): termEndTime",
        graphCreditLine.termEndTime.toString(),
        creditLine.termEndTime.toString()
      )
    }
    if (!graphCreditLine.lastFullPaymentTime.isEqualTo(creditLine.lastFullPaymentTime)) {
      console.error(
        "(graph), (web3): lastFullPaymentTime",
        graphCreditLine.lastFullPaymentTime.toString(),
        creditLine.lastFullPaymentTime.toString()
      )
    }
    if (!graphCreditLine.interestAprDecimal.isEqualTo(creditLine.interestAprDecimal)) {
      console.error(
        "(graph), (web3): interestAprDecimal",
        graphCreditLine.interestAprDecimal.toString(),
        creditLine.interestAprDecimal.toString()
      )
    }

    if (!creditLine.maxLimit.isEqualTo(graphCreditLine.maxLimit)) {
      console.error("(graph), (web3): maxLimit", graphCreditLine.maxLimit.toString(), creditLine.maxLimit.toString())
    }
    if (creditLine.name.toLowerCase() !== graphCreditLine.name.toLowerCase()) {
      console.error("(graph), (web3): name", graphCreditLine.name, creditLine.name)
    }
    if (!creditLine.periodDueAmount.isEqualTo(graphCreditLine.periodDueAmount)) {
      console.error(
        "(graph), (web3): periodDueAmount",
        graphCreditLine.periodDueAmount.toString(),
        creditLine.periodDueAmount.toString()
      )
    }
    if (!creditLine.remainingPeriodDueAmount.isEqualTo(graphCreditLine.remainingPeriodDueAmount)) {
      console.error(
        "(graph), (web3): remainingPeriodDueAmount",
        graphCreditLine.remainingPeriodDueAmount.toString(),
        creditLine.remainingPeriodDueAmount.toString()
      )
    }
    if (!creditLine.remainingTotalDueAmount.isEqualTo(graphCreditLine.remainingTotalDueAmount)) {
      console.error(
        "(graph), (web3): remainingTotalDueAmount",
        graphCreditLine.remainingTotalDueAmount.toString(),
        creditLine.remainingTotalDueAmount.toString()
      )
    }
    if (creditLine.termEndDate !== graphCreditLine.termEndDate) {
      console.error("(graph), (web3): termEndDate", graphCreditLine.termEndDate, creditLine.termEndDate)
    }
    if (!creditLine.totalDueAmount.isEqualTo(graphCreditLine.totalDueAmount)) {
      console.error(
        "(graph), (web3): totalDueAmount",
        graphCreditLine.totalDueAmount.toString(),
        creditLine.totalDueAmount.toString()
      )
    }
  }
}

function validateTranche(tranche: TrancheInfo, graphTranche: TrancheInfo) {
  Object.keys(tranche).forEach((key: string) => {
    if (typeof tranche[key] === "object" && !graphTranche[key].isEqualTo(tranche[key])) {
      console.error(key, "(graph), (web3)", graphTranche[key].toString(), tranche[key].toString())
    } else if (typeof tranche[key] === "number" && graphTranche[key] !== tranche[key]) {
      console.error(key, "(graph), (web3)", graphTranche[key], tranche[key])
    } else if (typeof tranche[key] !== "object" && typeof tranche[key] !== "number") {
      console.error("Couldn't compare: ", key, graphTranche[key], tranche[key])
    }
  })
}

function validateBacker(backer: TranchedPoolBacker, graphBacker: TranchedPoolBacker, i: number) {
  console.log(
    "[STARTING] Index: ",
    i,
    "User address: ",
    backer.address,
    " Tranched Pool: ",
    backer.tranchedPool.address
  )
  if (!graphBacker) {
    const arr = Object.keys(backer).map((key: string): boolean => {
      if (key === "tokenInfos") {
        return true
      }
      return backer[key].isZero()
    })
    if (arr.every((v): boolean => v)) {
      // Backer only exists on the frontend
      return
    }
    console.error("Backer exists on web3 but was not created on subgraph", backer.address)
    return
  }

  Object.keys(backer).forEach((key: string) => {
    if (key !== "tokenInfos" && key !== "tranchedPool" && key !== "goldfinchProtocol") {
      if (typeof graphBacker[key] === "object" && !graphBacker[key].isEqualTo(backer[key])) {
        console.error(key, "(graph), (web3)", graphBacker[key].toString(), backer[key].toString())
      } else if (typeof graphBacker[key] === "string" && graphBacker[key] !== backer[key]) {
        console.error(key, "(graph), (web3)", graphBacker[key], backer[key])
      } else if (typeof graphBacker[key] !== "object" && typeof graphBacker[key] !== "string") {
        console.error("Couldn't compare: ", key, backer[key], graphBacker[key])
      }
    }
  })

  validateTokenInfo(backer.address, backer.tokenInfos, graphBacker.tokenInfos)
}

function validateTokenInfo(address: string, tokenInfoWeb3: TokenInfo[], graphTokenInfo: TokenInfo[]) {
  if (!tokenInfoWeb3) {
    console.error("Web3 undefined tokenInfo for ", address)
    return
  }
  if (!graphTokenInfo) {
    console.error("Subgraph undefined tokenInfo for ", address)
    return
  }
  console.log("Checking token infos")
  tokenInfoWeb3.map((token) => {
    let hasErrors = false
    const graphToken = graphTokenInfo.find((t) => t.id === token.id)
    if (graphToken) {
      Object.keys(token).forEach((key: string) => {
        if (typeof token[key] === "object" && !token[key].isEqualTo(graphToken[key])) {
          console.error("(graph), (web3)", key, graphToken[key].toString(), token[key].toString())
          hasErrors = true
        } else if (typeof token[key] === "number" && token[key] !== graphToken[key]) {
          console.error("(graph), (web3)", key, graphToken[key], token[key])
          hasErrors = true
        } else if (typeof token[key] === "string" && token[key].toLowerCase() !== graphToken[key].toLowerCase()) {
          console.error("(graph), (web3)", key, graphToken[key], token[key])
          hasErrors = true
        } else if (typeof token[key] !== "object" && typeof token[key] !== "number" && typeof token[key] !== "string") {
          console.error("Couldn't compare: ", key, token[key], graphToken[key])
        }
      })
    }
    if (hasErrors) {
      console.error("(graph), (web3)", graphToken, token)
    }
    return hasErrors
  })
}

export function validateTranchedPool(tranchedPool: TranchedPool, graphTranchedPool: TranchedPool) {
  console.log("[STARTING] Tranched pool: ", tranchedPool.displayName, tranchedPool.address.toLowerCase())
  if (tranchedPool.creditLineAddress.toLowerCase() !== graphTranchedPool.creditLineAddress.toLowerCase()) {
    console.error(
      "(graph), (web3): creditLineAddress: ",
      tranchedPool.creditLineAddress,
      graphTranchedPool.creditLineAddress
    )
  }
  if (tranchedPool.poolState !== graphTranchedPool.poolState) {
    console.error("(web3), (graph): state: ", tranchedPool.poolState, graphTranchedPool.poolState)
  }
  if (tranchedPool.metadata?.name !== graphTranchedPool.metadata?.name) {
    console.error("(web3), (graph): metadata: ", tranchedPool.metadata, graphTranchedPool.metadata)
  }
  if (!tranchedPool.juniorFeePercent.isEqualTo(graphTranchedPool.juniorFeePercent)) {
    console.error(
      "(web3), (graph): juniorFeePercent: ",
      tranchedPool.juniorFeePercent.toString(),
      graphTranchedPool.juniorFeePercent.toString()
    )
  }
  if (!tranchedPool.reserveFeePercent.isEqualTo(graphTranchedPool.reserveFeePercent)) {
    console.log(
      "(web3), (graph): reserveFeePercent: ",
      tranchedPool.reserveFeePercent.toString(),
      graphTranchedPool.reserveFeePercent.toString()
    )
  }
  if (!tranchedPool.estimatedLeverageRatio.isEqualTo(graphTranchedPool.estimatedLeverageRatio)) {
    console.log(
      "(web3), (graph): estimatedLeverageRatio: ",
      tranchedPool.estimatedLeverageRatio.toString(),
      graphTranchedPool.estimatedLeverageRatio.toString()
    )
  }
  if (!tranchedPool.estimatedSeniorPoolContribution.isEqualTo(graphTranchedPool.estimatedSeniorPoolContribution)) {
    console.log(
      "(web3), (graph): estimatedSeniorPoolContribution: ",
      tranchedPool.estimatedSeniorPoolContribution.toString(),
      graphTranchedPool.estimatedSeniorPoolContribution.toString()
    )
  }

  validateTranche(tranchedPool.juniorTranche, graphTranchedPool.juniorTranche)
  validateTranche(tranchedPool.seniorTranche, graphTranchedPool.seniorTranche)

  if (!tranchedPool.totalDeposited.isEqualTo(graphTranchedPool.totalDeposited)) {
    console.log(
      "(web3), (graph): totalDeposited: ",
      tranchedPool.totalDeposited.toString(),
      graphTranchedPool.totalDeposited.toString()
    )
  }
  if (tranchedPool.isV1StyleDeal !== graphTranchedPool.isV1StyleDeal) {
    console.log("(web3), (graph): isV1StyleDeal: ", tranchedPool.isV1StyleDeal, graphTranchedPool.isV1StyleDeal)
  }
  if (tranchedPool.isMigrated !== graphTranchedPool.isMigrated) {
    console.log("(web3), (graph): isMigrated: ", tranchedPool.isMigrated, graphTranchedPool.isMigrated)
  }
  if (tranchedPool.isPaused !== graphTranchedPool.isPaused) {
    console.log("(web3), (graph): isPaused: ", tranchedPool.isPaused, graphTranchedPool.isPaused)
  }
  validateCreditLine(tranchedPool.creditLine, graphTranchedPool.creditLine)
}

export async function generalBackerValidation(
  goldfinchProtocol: GoldfinchProtocol,
  subgraphData,
  currentBlock: BlockInfo
) {
  PROD_BACKERS_ADDRESS.forEach(async (address, i) => {
    const backersSubgraph = await parseBackers(subgraphData.tranchedPools, goldfinchProtocol, currentBlock, address)
    backersSubgraph.map(async (backer) => {
      const originalBacker = new TranchedPoolBacker(backer.address, backer.tranchedPool, goldfinchProtocol)
      await originalBacker.initialize(currentBlock)
      validateBacker(originalBacker, backer, i)
    })
  })
}

export function generalTranchedPoolsValidationByBackers(
  backersWeb3: TranchedPoolBacker[],
  backersSubgraph: TranchedPoolBacker[]
) {
  backersWeb3.forEach((b) => {
    const graphBacker = backersSubgraph.find(
      (s) => s.tranchedPool.address.toLowerCase() === b.tranchedPool.address.toLowerCase()
    )
    if (graphBacker) {
      validateTranchedPool(b.tranchedPool, graphBacker.tranchedPool)
    } else {
      console.error("Pool doesn't exists on subgraph")
    }
  })
}
