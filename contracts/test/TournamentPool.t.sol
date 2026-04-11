// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/TournamentPool.sol";

contract TournamentPoolTest is Test {
    TournamentPool pool;

    address operator;
    uint256 operatorKey;
    address platformAddr;
    address player1;
    address player2;

    bytes32 matchId = keccak256("match-1");
    bytes32 deckHash = keccak256("deck-hash");
    bytes32 finalStateHash = keccak256("final-state");

    function setUp() public {
        (operator, operatorKey) = makeAddrAndKey("operator");
        platformAddr = makeAddr("platform");
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");

        pool = new TournamentPool(operator, platformAddr);

        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
    }

    // ── Deposit ──

    function test_deposit_player1() public {
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);

        TournamentPool.Match memory m = pool.getMatch(matchId);
        assertEq(m.player1, player1);
        assertTrue(m.status == TournamentPool.MatchStatus.WaitingForPlayer2);
    }

    function test_deposit_both_players() public {
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);

        vm.prank(player2);
        pool.deposit{value: 1 ether}(matchId);

        TournamentPool.Match memory m = pool.getMatch(matchId);
        assertEq(m.player1, player1);
        assertEq(m.player2, player2);
        assertTrue(m.status == TournamentPool.MatchStatus.Funded);
    }

    function test_deposit_wrong_amount() public {
        vm.prank(player1);
        vm.expectRevert(TournamentPool.WrongAmount.selector);
        pool.deposit{value: 0.5 ether}(matchId);
    }

    function test_deposit_same_player_twice() public {
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);

        vm.prank(player1);
        vm.expectRevert(TournamentPool.AlreadyDeposited.selector);
        pool.deposit{value: 1 ether}(matchId);
    }

    function test_deposit_third_player_rejected() public {
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);
        vm.prank(player2);
        pool.deposit{value: 1 ether}(matchId);

        address player3 = makeAddr("player3");
        vm.deal(player3, 10 ether);
        vm.prank(player3);
        vm.expectRevert(TournamentPool.MatchNotOpen.selector);
        pool.deposit{value: 1 ether}(matchId);
    }

    // ── Submit Result ──

    function test_submitResult() public {
        _fundMatch();

        bytes memory sig = _signResult(matchId, player1, deckHash, finalStateHash);

        pool.submitResult(matchId, player1, deckHash, finalStateHash, sig);

        TournamentPool.Match memory m = pool.getMatch(matchId);
        assertEq(m.winner, player1);
        assertTrue(m.status == TournamentPool.MatchStatus.Resolved);
        assertEq(m.deckHash, deckHash);
        assertEq(m.finalStateHash, finalStateHash);
        assertEq(pool.accumulatedRake(), 0.2 ether);
    }

    function test_submitResult_invalid_sig() public {
        _fundMatch();

        // Sign with wrong key
        (, uint256 wrongKey) = makeAddrAndKey("wrong");
        bytes32 messageHash = keccak256(abi.encodePacked(matchId, player1, deckHash, finalStateHash));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(TournamentPool.InvalidSignature.selector);
        pool.submitResult(matchId, player1, deckHash, finalStateHash, badSig);
    }

    function test_submitResult_not_funded() public {
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);

        bytes memory sig = _signResult(matchId, player1, deckHash, finalStateHash);

        vm.expectRevert(TournamentPool.MatchNotFunded.selector);
        pool.submitResult(matchId, player1, deckHash, finalStateHash, sig);
    }

    // ── Claim ──

    function test_claim() public {
        _fundMatch();
        bytes memory sig = _signResult(matchId, player1, deckHash, finalStateHash);
        pool.submitResult(matchId, player1, deckHash, finalStateHash, sig);

        uint256 balBefore = player1.balance;

        vm.prank(player1);
        pool.claim(matchId);

        assertEq(player1.balance, balBefore + 1.8 ether);

        TournamentPool.Match memory m = pool.getMatch(matchId);
        assertTrue(m.status == TournamentPool.MatchStatus.Claimed);
    }

    function test_claim_not_winner() public {
        _fundMatch();
        bytes memory sig = _signResult(matchId, player1, deckHash, finalStateHash);
        pool.submitResult(matchId, player1, deckHash, finalStateHash, sig);

        vm.prank(player2);
        vm.expectRevert(TournamentPool.NotWinner.selector);
        pool.claim(matchId);
    }

    // ── Refund ──

    function test_refund_solo_deposit() public {
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);

        uint256 balBefore = player1.balance;

        vm.prank(player1);
        pool.refund(matchId);

        assertEq(player1.balance, balBefore + 1 ether);
    }

    function test_refund_after_timeout() public {
        _fundMatch();

        // Warp past timeout
        vm.warp(block.timestamp + 2 hours + 1);

        uint256 bal1 = player1.balance;
        uint256 bal2 = player2.balance;

        vm.prank(player1);
        pool.refund(matchId);

        assertEq(player1.balance, bal1 + 1 ether);
        assertEq(player2.balance, bal2 + 1 ether);
    }

    function test_refund_too_early() public {
        _fundMatch();

        vm.prank(player1);
        vm.expectRevert(TournamentPool.TooEarlyForRefund.selector);
        pool.refund(matchId);
    }

    // ── Rake ──

    function test_withdrawRake() public {
        _fundMatch();
        bytes memory sig = _signResult(matchId, player1, deckHash, finalStateHash);
        pool.submitResult(matchId, player1, deckHash, finalStateHash, sig);

        uint256 balBefore = platformAddr.balance;

        vm.prank(platformAddr);
        pool.withdrawRake();

        assertEq(platformAddr.balance, balBefore + 0.2 ether);
        assertEq(pool.accumulatedRake(), 0);
    }

    function test_withdrawRake_not_platform() public {
        _fundMatch();
        bytes memory sig = _signResult(matchId, player1, deckHash, finalStateHash);
        pool.submitResult(matchId, player1, deckHash, finalStateHash, sig);

        vm.prank(player1);
        vm.expectRevert(TournamentPool.NotPlatform.selector);
        pool.withdrawRake();
    }

    // ── Full flow ──

    function test_full_match_flow() public {
        // 1. Both deposit
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);
        vm.prank(player2);
        pool.deposit{value: 1 ether}(matchId);

        // Contract holds 2 MON
        assertEq(address(pool).balance, 2 ether);

        // 2. Submit result (player2 wins)
        bytes memory sig = _signResult(matchId, player2, deckHash, finalStateHash);
        pool.submitResult(matchId, player2, deckHash, finalStateHash, sig);

        // 3. Winner claims
        uint256 balBefore = player2.balance;
        vm.prank(player2);
        pool.claim(matchId);
        assertEq(player2.balance, balBefore + 1.8 ether);

        // 4. Platform withdraws rake
        vm.prank(platformAddr);
        pool.withdrawRake();
        assertEq(platformAddr.balance, 0.2 ether);

        // Contract empty
        assertEq(address(pool).balance, 0);
    }

    // ── Helpers ──

    function _fundMatch() internal {
        vm.prank(player1);
        pool.deposit{value: 1 ether}(matchId);
        vm.prank(player2);
        pool.deposit{value: 1 ether}(matchId);
    }

    function _signResult(
        bytes32 _matchId,
        address _winner,
        bytes32 _deckHash,
        bytes32 _finalStateHash
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(_matchId, _winner, _deckHash, _finalStateHash));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }
}
