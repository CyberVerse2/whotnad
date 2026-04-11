// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TournamentPool
 * @notice Trustless escrow for Whot! 1v1 matches on Monad.
 *
 * Flow:
 *   1. Both players call deposit(matchId) sending ENTRY_FEE each.
 *   2. Game plays off-chain. Backend signs the result.
 *   3. Backend calls submitResult() with the signed proof.
 *   4. Winner calls claim(matchId) to pull PAYOUT.
 *   5. Platform calls withdrawRake() to pull accumulated rake.
 *   6. If no result after TIMEOUT, either player calls refund(matchId).
 */
contract TournamentPool {
    // ── Constants ──
    uint256 public constant ENTRY_FEE = 1 ether;          // 1 MON
    uint256 public constant PAYOUT = 1.8 ether;           // 1.8 MON to winner
    uint256 public constant RAKE = 0.2 ether;             // 0.2 MON platform fee
    uint256 public constant MATCH_TIMEOUT = 2 hours;      // refund window

    // ── State ──
    address public immutable operator;     // backend signer
    address public immutable platform;     // rake recipient
    uint256 public accumulatedRake;

    enum MatchStatus { Empty, WaitingForPlayer2, Funded, Resolved, Claimed, Refunded }

    struct Match {
        address player1;
        address player2;
        address winner;
        bytes32 deckHash;
        bytes32 finalStateHash;
        MatchStatus status;
        uint256 fundedAt;
    }

    mapping(bytes32 => Match) public matches;

    // ── Events ──
    event Deposited(bytes32 indexed matchId, address indexed player, uint8 slot);
    event ResultSubmitted(bytes32 indexed matchId, address indexed winner, bytes32 deckHash, bytes32 finalStateHash);
    event Claimed(bytes32 indexed matchId, address indexed winner, uint256 amount);
    event Refunded(bytes32 indexed matchId, address indexed player, uint256 amount);
    event RakeWithdrawn(address indexed to, uint256 amount);

    // ── Errors ──
    error WrongAmount();
    error MatchNotOpen();
    error AlreadyDeposited();
    error MatchNotFunded();
    error InvalidSignature();
    error NotWinner();
    error AlreadyClaimed();
    error TooEarlyForRefund();
    error MatchNotRefundable();
    error NoRake();
    error NotPlatform();
    error TransferFailed();

    constructor(address _operator, address _platform) {
        operator = _operator;
        platform = _platform;
    }

    // ── Deposit ──

    /**
     * @notice Both players call this to enter a match. Sends exactly ENTRY_FEE.
     * @param matchId Unique match identifier (generated off-chain).
     */
    function deposit(bytes32 matchId) external payable {
        if (msg.value != ENTRY_FEE) revert WrongAmount();

        Match storage m = matches[matchId];

        if (m.status == MatchStatus.Empty) {
            // First player
            m.player1 = msg.sender;
            m.status = MatchStatus.WaitingForPlayer2;
            emit Deposited(matchId, msg.sender, 1);
        } else if (m.status == MatchStatus.WaitingForPlayer2) {
            if (msg.sender == m.player1) revert AlreadyDeposited();
            // Second player
            m.player2 = msg.sender;
            m.status = MatchStatus.Funded;
            m.fundedAt = block.timestamp;
            emit Deposited(matchId, msg.sender, 2);
        } else {
            revert MatchNotOpen();
        }
    }

    // ── Submit Result ──

    /**
     * @notice Backend submits the match result with a signed proof.
     * @param matchId The match identifier.
     * @param winner Address of the winning player.
     * @param deckHash Hash of the shuffled deck (from Drand seed).
     * @param finalStateHash Hash of the complete final game state.
     * @param sig Backend's ECDSA signature over the result hash.
     */
    function submitResult(
        bytes32 matchId,
        address winner,
        bytes32 deckHash,
        bytes32 finalStateHash,
        bytes memory sig
    ) external {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Funded) revert MatchNotFunded();

        // Verify the winner is one of the players
        require(winner == m.player1 || winner == m.player2, "Winner not in match");

        // Verify operator signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            matchId, winner, deckHash, finalStateHash
        ));
        bytes32 ethSignedHash = _toEthSignedMessageHash(messageHash);

        if (_recoverSigner(ethSignedHash, sig) != operator) revert InvalidSignature();

        m.winner = winner;
        m.deckHash = deckHash;
        m.finalStateHash = finalStateHash;
        m.status = MatchStatus.Resolved;

        // Rake goes to accumulator
        accumulatedRake += RAKE;

        emit ResultSubmitted(matchId, winner, deckHash, finalStateHash);
    }

    // ── Claim ──

    /**
     * @notice Winner pulls their payout after result is submitted.
     * @param matchId The match identifier.
     */
    function claim(bytes32 matchId) external {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Resolved) revert MatchNotFunded();
        if (msg.sender != m.winner) revert NotWinner();

        m.status = MatchStatus.Claimed;

        (bool ok, ) = payable(m.winner).call{value: PAYOUT}("");
        if (!ok) revert TransferFailed();

        emit Claimed(matchId, m.winner, PAYOUT);
    }

    // ── Refund ──

    /**
     * @notice If no result submitted after MATCH_TIMEOUT, either player can get a refund.
     * @param matchId The match identifier.
     */
    function refund(bytes32 matchId) external {
        Match storage m = matches[matchId];

        if (m.status == MatchStatus.WaitingForPlayer2) {
            // Only player1 deposited — refund immediately
            if (msg.sender != m.player1) revert MatchNotRefundable();
            m.status = MatchStatus.Refunded;
            (bool ok, ) = payable(m.player1).call{value: ENTRY_FEE}("");
            if (!ok) revert TransferFailed();
            emit Refunded(matchId, m.player1, ENTRY_FEE);
            return;
        }

        if (m.status != MatchStatus.Funded) revert MatchNotRefundable();
        if (block.timestamp < m.fundedAt + MATCH_TIMEOUT) revert TooEarlyForRefund();

        require(msg.sender == m.player1 || msg.sender == m.player2, "Not a player");

        m.status = MatchStatus.Refunded;

        // Refund both players
        (bool ok1, ) = payable(m.player1).call{value: ENTRY_FEE}("");
        if (!ok1) revert TransferFailed();
        (bool ok2, ) = payable(m.player2).call{value: ENTRY_FEE}("");
        if (!ok2) revert TransferFailed();

        emit Refunded(matchId, m.player1, ENTRY_FEE);
        emit Refunded(matchId, m.player2, ENTRY_FEE);
    }

    // ── Rake ──

    /**
     * @notice Platform withdraws accumulated rake.
     */
    function withdrawRake() external {
        if (msg.sender != platform) revert NotPlatform();
        uint256 amount = accumulatedRake;
        if (amount == 0) revert NoRake();

        accumulatedRake = 0;

        (bool ok, ) = payable(platform).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit RakeWithdrawn(platform, amount);
    }

    // ── View ──

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    // ── Internal ──

    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid sig length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) v += 27;

        return ecrecover(hash, v, r, s);
    }

    receive() external payable {}
}
