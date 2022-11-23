// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/interfaces/IERC721Upgradeable.sol";

import {ICapitalLedger} from "../../../interfaces/ICapitalLedger.sol";
import {StakedPosition, StakedPositionType} from "../../../interfaces/IStakingRewards.sol";

import "../../../protocol/core/membership/CapitalLedger.sol";
import {CapitalAssets, CapitalAssetType} from "../../../protocol/core/membership/assets/CapitalAssets.sol";
import {PoolTokensAsset} from "../../../protocol/core/membership/assets/PoolTokensAsset.sol";
import {StakedFiduAsset} from "../../../protocol/core/membership/assets/StakedFiduAsset.sol";
import {FiduConversions} from "../../../library/FiduConversions.sol";
import {Test, stdError} from "forge-std/Test.sol";

import {CakeHelper} from "../../cake/helpers/CakeHelper.t.sol";
import "../../../interfaces/IPoolTokens.sol";

import {console} from "forge-std/console.sol";

contract CapitalLedgerTest is Test {
  address public constant MEMBERSHIP_ORCHESTRATOR_ADDRESS = address(123456);
  address public constant STAKING_REWARDS_ADDRESS = 0xFD6FF39DA508d281C2d255e9bBBfAb34B6be60c3;
  address public constant POOL_TOKENS_ADDRESS = 0x57686612C601Cb5213b01AA8e80AfEb24BBd01df;
  address public constant GFI_ADDRESS = 0xdab396cCF3d84Cf2D07C4454e10C8A6F5b008D2b;
  address public constant SENIOR_POOL_ADDRESS = 0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822;
  address public constant FIDU_ADDRESS = 0x6a445E9F40e0b97c92d0b8a3366cEF1d67F700BF;

  uint256 public constant MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
  uint256 public constant FIDU_SHARE_PRICE_UPPER_BOUND = 1 * 10**36;
  uint256 public constant FIDU_AMOUNT_UPPER_BOUND = MAX_UINT256 / FiduConversions.FIDU_MANTISSA;

  CakeHelper private cake;

  CapitalLedger private ledger;

  Context private context;

  function setUp() public {
    cake = new CakeHelper(address(this));
    ledger = new CapitalLedger(cake.context());
    context = cake.context();

    cake.router().setContract(Routing.Keys.MembershipOrchestrator, address(this));

    cake.router().setContract(Routing.Keys.StakingRewards, address(STAKING_REWARDS_ADDRESS));
    cake.router().setContract(Routing.Keys.PoolTokens, address(POOL_TOKENS_ADDRESS));
    cake.router().setContract(Routing.Keys.SeniorPool, address(SENIOR_POOL_ADDRESS));
    cake.router().setContract(Routing.Keys.FIDU, address(FIDU_ADDRESS));
    cake.router().setContract(Routing.Keys.GFI, address(GFI_ADDRESS));

    vm.label(STAKING_REWARDS_ADDRESS, "StakingRewards");
    vm.label(POOL_TOKENS_ADDRESS, "PoolTokens");
    vm.label(GFI_ADDRESS, "GFI");
    vm.label(SENIOR_POOL_ADDRESS, "Senior Pool");
    vm.label(FIDU_ADDRESS, "FIDU");
    vm.label(MEMBERSHIP_ORCHESTRATOR_ADDRESS, "Membership Orchestrator");
  }

  function test_depositERC721_poolToken(
    address owner,
    uint256 assetId,
    address poolTokenAddress,
    uint256 tranche,
    uint256 principalAmount
  ) public {
    address assetAddress = POOL_TOKENS_ADDRESS;

    vm.mockCall(
      POOL_TOKENS_ADDRESS,
      abi.encodeWithSelector(bytes4(keccak256("getTokenInfo(uint256)"))),
      abi.encode(
        IPoolTokens.TokenInfo(poolTokenAddress, tranche, principalAmount, principalAmount / 2, principalAmount / 5)
      )
    );

    vm.mockCall(
      assetAddress,
      abi.encodeWithSelector(bytes4(keccak256("safeTransferFrom(address,address,uint256)"))),
      abi.encode(1)
    );

    vm.expectEmit(true, false, false, true);
    emit CapitalERC721Deposit(
      owner,
      POOL_TOKENS_ADDRESS,
      ledger.totalSupply() + 1,
      assetId,
      principalAmount - principalAmount / 2
    );

    uint256 id = ledger.depositERC721({owner: owner, assetAddress: assetAddress, assetTokenId: assetId});

    assertEq(ledger.erc721IdOf(id), assetId);
    assertEq(ledger.assetAddressOf(id), assetAddress);
    assertEq(ledger.ownerOf(id), owner);
  }

  function test_depositERC721_stakedFidu(address owner, uint256 assetId) public {
    vm.mockCall(
      STAKING_REWARDS_ADDRESS,
      abi.encodeWithSelector(bytes4(keccak256("safeTransferFrom(address,address,uint256)"))),
      abi.encode(1)
    );

    uint256 stakedBalance = 100 * 1e18;
    vm.mockCall(
      STAKING_REWARDS_ADDRESS,
      abi.encodeWithSelector(bytes4(keccak256("stakedBalanceOf(uint256)"))),
      abi.encode(stakedBalance)
    );

    uint256 sharePrice = 1e12;
    vm.mockCall(SENIOR_POOL_ADDRESS, abi.encodeWithSelector(bytes4(keccak256("sharePrice()"))), abi.encode(sharePrice));

    vm.expectEmit(true, false, false, true);
    emit CapitalERC721Deposit(
      owner,
      STAKING_REWARDS_ADDRESS,
      ledger.totalSupply() + 1,
      assetId,
      FiduConversions.fiduToUsdc(stakedBalance, sharePrice)
    );

    {
      // Declare the position as a Staked Fidu token
      StakedPosition memory position;
      position.positionType = StakedPositionType.Fidu;
      vm.mockCall(
        STAKING_REWARDS_ADDRESS,
        abi.encodeWithSelector(bytes4(keccak256("getPosition(uint256)"))),
        abi.encode(position)
      );
    }

    uint256 id = ledger.depositERC721({owner: owner, assetAddress: STAKING_REWARDS_ADDRESS, assetTokenId: assetId});

    assertEq(ledger.erc721IdOf(id), assetId);
    assertEq(ledger.assetAddressOf(id), STAKING_REWARDS_ADDRESS);
    assertEq(ledger.ownerOf(id), owner);
  }

  function test_depositERC721_invalidAsset(address assetAddress)
    public
    assume(assetAddress != STAKING_REWARDS_ADDRESS && assetAddress != POOL_TOKENS_ADDRESS)
  {
    vm.expectRevert(abi.encodeWithSelector(CapitalAssets.InvalidAsset.selector, assetAddress));
    ledger.depositERC721({owner: address(2), assetAddress: assetAddress, assetTokenId: 10});
  }

  function test_depositERC721_curveLPToken() public {
    {
      // Declare the position as a Staked CurveLP token
      StakedPosition memory position;
      position.positionType = StakedPositionType.CurveLP;
      vm.mockCall(
        STAKING_REWARDS_ADDRESS,
        abi.encodeWithSelector(bytes4(keccak256("getPosition(uint256)"))),
        abi.encode(position)
      );
    }

    vm.expectRevert(abi.encodeWithSelector(CapitalAssets.InvalidAssetWithId.selector, STAKING_REWARDS_ADDRESS, 10));
    ledger.depositERC721({owner: address(2), assetAddress: STAKING_REWARDS_ADDRESS, assetTokenId: 10});
  }

  function test_erc721IdOf(
    address owner,
    uint256 poolTokenId,
    uint256 stakedFiduId
  ) public withDeposit_poolToken(owner, poolTokenId, 20e18) withDeposit_stakedFidu(owner, stakedFiduId, 100e18, 1e12) {
    assertEq(ledger.erc721IdOf(1), poolTokenId);
    assertEq(ledger.erc721IdOf(2), stakedFiduId);
  }

  function test_withdraw_erc721(
    address owner,
    uint256 id,
    uint256 poolTokenAmount
  ) public withDeposit_poolToken(owner, id, poolTokenAmount) withDeposit_stakedFidu(owner, 2, 10e18, 1e12) {
    vm.expectEmit(true, false, false, true);
    emit CapitalERC721Withdrawal(owner, 1, POOL_TOKENS_ADDRESS, block.timestamp);

    ledger.withdraw(1);

    assertEq(ledger.erc721IdOf(1), 0);
    assertEq(ledger.ownerOf(1), address(0));
    assertEq(ledger.assetAddressOf(1), address(0));

    assertEq(ledger.erc721IdOf(2), 2);
    assertEq(ledger.ownerOf(2), owner);
    assertEq(ledger.assetAddressOf(2), STAKING_REWARDS_ADDRESS);
    assertEq(ledger.balanceOf(owner), 1);
    assertEq(ledger.tokenOfOwnerByIndex(owner, 0), 2);
  }

  function test_assetAddressOf(
    address owner,
    uint256 poolTokenId,
    uint256 poolTokenAmount,
    uint256 stakedFiduTokenId,
    uint256 stakedFiduAmount,
    uint256 fiduSharePrice
  )
    public
    assume(poolTokenId != 0)
    withDeposit_poolToken(owner, poolTokenId, poolTokenAmount)
    withDeposit_stakedFidu(owner, stakedFiduTokenId, stakedFiduAmount, fiduSharePrice)
  {
    (stakedFiduAmount, fiduSharePrice) = boundFiduParameters(stakedFiduAmount, fiduSharePrice);

    assertEq(ledger.assetAddressOf(0), address(0));
    assertEq(ledger.assetAddressOf(1), POOL_TOKENS_ADDRESS);
    assertEq(ledger.assetAddressOf(2), STAKING_REWARDS_ADDRESS);
    assertEq(ledger.assetAddressOf(3), address(0));
  }

  function test_ownerOf(
    address owner,
    uint256 stakedFiduAmount,
    uint256 fiduSharePrice,
    uint256 poolTokenAmount
  )
    public
    withDeposit_poolToken(owner, 101, poolTokenAmount)
    withDeposit_stakedFidu(owner, 100, stakedFiduAmount, fiduSharePrice)
  {
    (stakedFiduAmount, fiduSharePrice) = boundFiduParameters(stakedFiduAmount, fiduSharePrice);

    assertEq(ledger.ownerOf(0), address(0));
    assertEq(ledger.ownerOf(1), owner);
    assertEq(ledger.ownerOf(2), owner);
    assertEq(ledger.ownerOf(4), address(0));
  }

  function test_tokenByIndex(uint256 amount)
    public
    withDeposit_poolToken(address(1), 101, amount)
    withDeposit_stakedFidu(address(2), 100, amount, 1e12)
  {
    assertEq(ledger.tokenByIndex(0), 1);
    assertEq(ledger.erc721IdOf(1), 101);

    assertEq(ledger.tokenByIndex(1), 2);
    assertEq(ledger.erc721IdOf(2), 100);
  }

  function test_tokenByIndex_noTokens() public {
    vm.expectRevert(CapitalLedger.IndexGreaterThanTokenSupply.selector);
    ledger.tokenByIndex(0);
  }

  //////////////////////////////////////////////////////////////////
  // Helpers

  modifier assume(bool boolean) {
    vm.assume(boolean);
    _;
  }

  function boundFiduParameters(uint256 fiduAmount, uint256 fiduSharePrice)
    private
    returns (uint256 boundedFiduAmount, uint256 boundedFiduSharePrice)
  {
    boundedFiduSharePrice = bound(fiduSharePrice, 1, FIDU_SHARE_PRICE_UPPER_BOUND);
    boundedFiduAmount = bound(fiduAmount, FiduConversions.USDC_MANTISSA, FIDU_AMOUNT_UPPER_BOUND);
    vm.assume((MAX_UINT256 / boundedFiduAmount) / boundedFiduSharePrice > 0);
  }

  function depositERC721(
    address owner,
    address assetAddress,
    uint256 tokenId
  ) private {
    vm.mockCall(
      assetAddress,
      abi.encodeWithSelector(
        bytes4(keccak256("safeTransferFrom(address,address,uint256)")),
        owner,
        address(ledger),
        tokenId
      ),
      abi.encode(true)
    );

    ledger.depositERC721({owner: owner, assetAddress: assetAddress, assetTokenId: tokenId});
  }

  function depositStakedFidu(
    address owner,
    uint256 assetTokenId,
    uint256 stakedBalance,
    uint256 fiduSharePrice
  ) private returns (uint256, uint256) {
    vm.assume(owner != address(0));
    (stakedBalance, fiduSharePrice) = boundFiduParameters(stakedBalance, fiduSharePrice);
    vm.mockCall(
      STAKING_REWARDS_ADDRESS,
      abi.encodeWithSelector(bytes4(keccak256("stakedBalanceOf(uint256)")), assetTokenId),
      abi.encode(stakedBalance)
    );
    vm.mockCall(
      SENIOR_POOL_ADDRESS,
      abi.encodeWithSelector(bytes4(keccak256("sharePrice()"))),
      abi.encode(fiduSharePrice)
    );

    {
      // Declare the position as Staked Fidu instead of CurveLP
      StakedPosition memory position;
      position.positionType = StakedPositionType.Fidu;
      vm.mockCall(
        STAKING_REWARDS_ADDRESS,
        abi.encodeWithSelector(bytes4(keccak256("getPosition(uint256)"))),
        abi.encode(position)
      );
    }

    vm.expectEmit(true, false, false, true);
    emit CapitalERC721Deposit(
      owner,
      STAKING_REWARDS_ADDRESS,
      ledger.totalSupply() + 1,
      assetTokenId,
      FiduConversions.fiduToUsdc(stakedBalance, fiduSharePrice)
    );

    depositERC721(owner, STAKING_REWARDS_ADDRESS, assetTokenId);
    return (stakedBalance, fiduSharePrice);
  }

  function depositPoolToken(
    address owner,
    uint256 assetTokenId,
    uint256 value
  ) private {
    vm.assume(owner != address(0));
    vm.assume(value < type(uint256).max / 4);

    vm.mockCall(
      POOL_TOKENS_ADDRESS,
      abi.encodeWithSelector(bytes4(keccak256("getTokenInfo(uint256)")), assetTokenId),
      abi.encode(IPoolTokens.TokenInfo(POOL_TOKENS_ADDRESS, 2, value * 3, value * 2, 10))
    );

    vm.expectEmit(true, false, false, true);
    emit CapitalERC721Deposit(owner, POOL_TOKENS_ADDRESS, ledger.totalSupply() + 1, assetTokenId, value);

    depositERC721(owner, POOL_TOKENS_ADDRESS, assetTokenId);
  }

  modifier withDeposit_poolToken(
    address owner,
    uint256 assetTokenId,
    uint256 value
  ) {
    depositPoolToken(owner, assetTokenId, value);
    _;
  }

  modifier withDeposit_stakedFidu(
    address owner,
    uint256 assetTokenId,
    uint256 stakedBalance,
    uint256 fiduSharePrice
  ) {
    depositStakedFidu(owner, assetTokenId, stakedBalance, fiduSharePrice);
    _;
  }

  event CapitalERC721Deposit(
    address indexed owner,
    address indexed assetAddress,
    uint256 positionId,
    uint256 assetTokenId,
    uint256 usdcEquivalent
  );

  event CapitalERC721Withdrawal(
    address indexed owner,
    uint256 positionId,
    address assetAddress,
    uint256 depositTimestamp
  );
}
