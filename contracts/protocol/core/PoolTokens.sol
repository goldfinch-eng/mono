// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../external/ERC721PresetMinterPauserAutoId.sol";
import "./GoldfinchConfig.sol";
import "./ConfigHelper.sol";
import "../../interfaces/ITranchedPool.sol";

/**
 * @title PoolTokens
 * @notice PoolTokens is an ERC721 compliant contract, which can represent
 *  junior tranche or senior tranche shares of any of the borrower pools.
 * @author Goldfinch
 */

contract PoolTokens is ERC721PresetMinterPauserAutoIdUpgradeSafe {
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  struct TokenInfo {
    address pool;
    uint256 tranche;
    uint256 principalAmount;
    uint256 principalRedeemed;
    uint256 interestRedeemed;
  }

  struct PoolInfo {
    uint256 limit;
    uint256 totalMinted;
    uint256 totalPrincipalRedeemed;
  }

  struct MintParams {
    uint256 principalAmount;
    uint256 tranche;
  }

  // tokenId => tokenInfo
  mapping(uint256 => TokenInfo) public tokens;
  mapping(address => PoolInfo) public pools;

  event TokenMinted(
    address indexed owner,
    address indexed pool,
    uint256 indexed tokenId,
    uint256 amount,
    uint256 tranche
  );

  event TokenRedeemed(
    address indexed owner,
    address indexed pool,
    uint256 indexed tokenId,
    uint256 principalRedeemed,
    uint256 interestRedeemed,
    uint256 tranche
  );

  event TokenBurned(address indexed owner, address indexed pool, uint256 indexed tokenId);

  /*
    We are using our own initializer function so that OZ doesn't automatically
    set owner as msg.sender. Also, it lets us set our config contract
  */
  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(address owner, GoldfinchConfig _config) external initializer {
    __Context_init_unchained();
    __AccessControl_init_unchained();
    __ERC165_init_unchained();
    // This is setting name and symbol of the NFT's
    __ERC721_init_unchained("Goldfinch V2 Pool Tokens", "GFI-V2-PT");
    __Pausable_init_unchained();
    __ERC721Pausable_init_unchained();

    config = _config;

    _setupRole(PAUSER_ROLE, owner);
    _setupRole(OWNER_ROLE, owner);

    _setRoleAdmin(PAUSER_ROLE, OWNER_ROLE);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
  }

  function mint(MintParams calldata params, address to) public onlyPool whenNotPaused {
    address poolAddress = _msgSender();

    uint256 tokenId = createToken(params, poolAddress);

    _mint(to, tokenId);
    emit TokenMinted(to, poolAddress, tokenId, params.principalAmount, params.tranche);
  }

  function redeem(
    uint256 tokenId,
    uint256 principalRedeemed,
    uint256 interestRedeemed
  ) public onlyPool whenNotPaused {
    TokenInfo storage token = tokens[tokenId];
    require(token.pool != address(0), "Invalid tokenId");
    require(_msgSender() == token.pool, "Only the token's pool can redeem");

    token.principalRedeemed = token.principalRedeemed.add(principalRedeemed);
    token.interestRedeemed = token.interestRedeemed.add(interestRedeemed);

    PoolInfo storage pool = pools[token.pool];
    pool.totalPrincipalRedeemed = pool.totalPrincipalRedeemed.add(principalRedeemed);
    require(pool.totalPrincipalRedeemed <= pool.totalMinted, "Cannot redeem more than we minted");
    emit TokenRedeemed(ownerOf(tokenId), token.pool, tokenId, principalRedeemed, interestRedeemed, token.tranche);
  }

  /**
   * @dev Burns a specific ERC721 token, and removes the data from our mappings
   * @param tokenId uint256 id of the ERC721 token to be burned.
   */
  function burn(uint256 tokenId) public virtual {
    TokenInfo memory token = getTokenInfo(tokenId);
    bool canBurn = _isApprovedOrOwner(_msgSender(), tokenId);
    bool fromTokenPool = validPool(_msgSender()) && token.pool == _msgSender();
    address owner = ownerOf(tokenId);
    require(canBurn || fromTokenPool, "ERC721Burnable: caller cannot burn this token");
    require(token.principalRedeemed == token.principalAmount, "Can only burn fully redeemed tokens");
    destroyAndBurn(tokenId);
    emit TokenBurned(owner, token.pool, tokenId);
  }

  function getTokenInfo(uint256 tokenId) public view returns (TokenInfo memory) {
    return tokens[tokenId];
  }

  function validPool(address sender) internal pure returns (bool) {
    // TODO: This is where we should do our create2 check
    sender;
    return true;
  }

  function createToken(MintParams memory params, address poolAddress) internal returns (uint256) {
    PoolInfo storage pool = pools[poolAddress];

    // Set the limit if this is the first minting ever
    if (pool.limit == 0) {
      // TODO: Uncomment after we actually have pools that we can deploy
      // pool.limit = ITranchedPool(poolAddress).limit();
      pool.limit = 1000000000;
    }

    uint256 tokenId = _tokenIdTracker.current();
    tokens[tokenId] = TokenInfo({
      pool: poolAddress,
      tranche: params.tranche,
      principalAmount: params.principalAmount,
      principalRedeemed: 0,
      interestRedeemed: 0
    });
    pool.totalMinted = pool.totalMinted.add(params.principalAmount);
    require(pool.totalMinted <= pool.limit, "Cannot mint beyond the limit");
    _tokenIdTracker.increment();
    return tokenId;
  }

  function destroyAndBurn(uint256 tokenId) internal {
    delete tokens[tokenId];
    _burn(tokenId);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId
  ) internal virtual override(ERC721PresetMinterPauserAutoIdUpgradeSafe) {
    require(config.goList(to) || to == address(0), "This address has not been go-listed");
    super._beforeTokenTransfer(from, to, tokenId);
  }

  modifier onlyPool() {
    require(validPool(_msgSender()), "Only pool can call mint");
    _;
  }
}
