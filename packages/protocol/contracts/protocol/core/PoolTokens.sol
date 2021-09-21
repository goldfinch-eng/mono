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
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");

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

  /**
   * @notice Called by pool to create a debt position in a particular tranche and amount
   * @param params Struct containing the tranche and the amount
   * @param to The address that should own the position
   * @return tokenId The token ID (auto-incrementing integer across all pools)
   */
  function mint(MintParams calldata params, address to)
    external
    virtual
    override
    onlyPool
    whenNotPaused
    returns (uint256 tokenId)
  {
    address poolAddress = _msgSender();
    tokenId = createToken(params, poolAddress);
    _mint(to, tokenId);
    emit TokenMinted(to, poolAddress, tokenId, params.principalAmount, params.tranche);
    return tokenId;
  }

  /**
   * @notice Updates a token to reflect the principal and interest amounts that have been redeemed.
   * @param tokenId The token id to update (must be owned by the pool calling this function)
   * @param principalRedeemed The incremental amount of principal redeemed (cannot be more than principal deposited)
   * @param interestRedeemed The incremental amount of interest redeemed
   */
  function redeem(
    uint256 tokenId,
    uint256 principalRedeemed,
    uint256 interestRedeemed
  ) external virtual override onlyPool whenNotPaused {
    TokenInfo storage token = tokens[tokenId];
    address poolAddr = token.pool;
    require(token.pool != address(0), "Invalid tokenId");
    require(_msgSender() == poolAddr, "Only the token's pool can redeem");

    PoolInfo storage pool = pools[poolAddr];
    pool.totalPrincipalRedeemed = pool.totalPrincipalRedeemed.add(principalRedeemed);
    require(pool.totalPrincipalRedeemed <= pool.totalMinted, "Cannot redeem more than we minted");

    token.principalRedeemed = token.principalRedeemed.add(principalRedeemed);
    require(
      token.principalRedeemed <= token.principalAmount,
      "Cannot redeem more than principal-deposited amount for token"
    );
    token.interestRedeemed = token.interestRedeemed.add(interestRedeemed);

    emit TokenRedeemed(ownerOf(tokenId), poolAddr, tokenId, principalRedeemed, interestRedeemed, token.tranche);
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

  /**
   * @notice Called by the GoldfinchFactory to register the pool as a valid pool. Only valid pools can mint/redeem
   * tokens
   * @param newPool The address of the newly created pool
   */
  function onPoolCreated(address newPool) external override onlyGoldfinchFactory {
    pools[newPool].created = true;
  }

  /**
   * @notice Returns a boolean representing whether the spender is the owner or the approved spender of the token
   * @param spender The address to check
   * @param tokenId The token id to check for
   * @return True if approved to redeem/transfer/burn the token, false if not
   */
  function isApprovedOrOwner(address spender, uint256 tokenId) external view override returns (bool) {
    return _isApprovedOrOwner(spender, tokenId);
  }

  function validPool(address sender) public view virtual override returns (bool) {
    return _validPool(sender);
  }

  function createToken(MintParams calldata params, address poolAddress) internal returns (uint256 tokenId) {
    PoolInfo storage pool = pools[poolAddress];

    _tokenIdTracker.increment();
    tokenId = _tokenIdTracker.current();
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

  function _validPool(address poolAddress) internal view virtual returns (bool) {
    return pools[poolAddress].created;
  }

  function _getTokenInfo(uint256 tokenId) internal view returns (TokenInfo memory) {
    return tokens[tokenId];
  }

  /**
   * @notice Migrates to a new goldfinch config address
   */
  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }

  modifier onlyAdmin() {
    require(isAdmin(), "Must have admin role to perform this action");
    _;
  }

  function isAdmin() public view returns (bool) {
    return hasRole(OWNER_ROLE, _msgSender());
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
