// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../external/ERC721PresetMinterPauserAutoId.sol";
import "./GoldfinchConfig.sol";
import "./ConfigHelper.sol";
import "../../interfaces/ITranchedPool.sol";
import "../../interfaces/IPoolTokens.sol";

/**
 * @title PoolTokens
 * @notice PoolTokens is an ERC721 compliant contract, which can represent
 *  junior tranche or senior tranche shares of any of the borrower pools.
 * @author Goldfinch
 */

contract PoolTokens is IPoolTokens, ERC721PresetMinterPauserAutoIdUpgradeSafe {
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  struct PoolInfo {
    uint256 limit;
    uint256 totalMinted;
    uint256 totalPrincipalRedeemed;
    bool created;
  }

  // tokenId => tokenInfo
  mapping(uint256 => TokenInfo) public tokens;
  // poolAddress => poolInfo
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

  function mint(MintParams calldata params, address to)
    external
    virtual
    override
    onlyPool
    whenNotPaused
    returns (uint256)
  {
    address poolAddress = _msgSender();
    uint256 tokenId = createToken(params, poolAddress);
    _mint(to, tokenId);
    emit TokenMinted(to, poolAddress, tokenId, params.principalAmount, params.tranche);
    return tokenId;
  }

  function redeem(
    uint256 tokenId,
    uint256 principalRedeemed,
    uint256 interestRedeemed
  ) external virtual override onlyPool whenNotPaused {
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
  function burn(uint256 tokenId) external virtual override whenNotPaused {
    TokenInfo memory token = _getTokenInfo(tokenId);
    bool canBurn = _isApprovedOrOwner(_msgSender(), tokenId);
    bool fromTokenPool = _validPool(_msgSender()) && token.pool == _msgSender();
    address owner = ownerOf(tokenId);
    require(canBurn || fromTokenPool, "ERC721Burnable: caller cannot burn this token");
    require(token.principalRedeemed == token.principalAmount, "Can only burn fully redeemed tokens");
    destroyAndBurn(tokenId);
    emit TokenBurned(owner, token.pool, tokenId);
  }

  function getTokenInfo(uint256 tokenId) external view virtual override returns (TokenInfo memory) {
    return _getTokenInfo(tokenId);
  }

  function _getTokenInfo(uint256 tokenId) internal view returns (TokenInfo memory) {
    return tokens[tokenId];
  }

  function validPool(address sender) public view virtual override returns (bool) {
    return _validPool(sender);
  }

  function _validPool(address sender) internal view virtual returns (bool) {
    return pools[sender].created;
  }

  function onPoolCreated(address newPool) external override onlyGoldfinchFactory {
    pools[newPool].created = true;
  }

  function createToken(MintParams memory params, address poolAddress) internal returns (uint256) {
    PoolInfo storage pool = pools[poolAddress];

    // Set the limit if this is the first minting ever
    if (pool.limit == 0) {
      pool.limit = ITranchedPool(poolAddress).creditLine().limit();
    }

    _tokenIdTracker.increment();
    uint256 tokenId = _tokenIdTracker.current();
    tokens[tokenId] = TokenInfo({
      pool: poolAddress,
      tranche: params.tranche,
      principalAmount: params.principalAmount,
      principalRedeemed: 0,
      interestRedeemed: 0
    });
    pool.totalMinted = pool.totalMinted.add(params.principalAmount);
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
  ) internal virtual override(ERC721PresetMinterPauserAutoIdUpgradeSafe) whenNotPaused {
    require(config.goList(to) || to == address(0), "This address has not been go-listed");
    super._beforeTokenTransfer(from, to, tokenId);
  }

  function isApprovedOrOwner(address spender, uint256 tokenId) external view override returns (bool) {
    return _isApprovedOrOwner(spender, tokenId);
  }

  modifier onlyGoldfinchFactory() {
    require(_msgSender() == config.goldfinchFactoryAddress(), "Only Goldfinch factory is allowed");
    _;
  }

  modifier onlyPool() {
    require(_validPool(_msgSender()), "Invalid pool!");
    _;
  }
}
