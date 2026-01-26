// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GameResultMint
 * @notice Records game results on-chain for players
 * @dev Emits ResultMinted event for each submitted result
 */
contract GameResultMint {
    struct Result {
        uint256 score;
        uint256 maxCombo;
        bool won;
        uint256 timestamp;
    }

    mapping(address => Result[]) private results;

    event ResultMinted(
        address indexed player,
        uint256 score,
        uint256 maxCombo,
        bool won,
        uint256 timestamp
    );

    function mintResult(uint256 score, uint256 maxCombo, bool won) external {
        results[msg.sender].push(Result({
            score: score,
            maxCombo: maxCombo,
            won: won,
            timestamp: block.timestamp
        }));

        emit ResultMinted(msg.sender, score, maxCombo, won, block.timestamp);
    }

    function getResultCount(address player) external view returns (uint256) {
        return results[player].length;
    }

    function getResult(address player, uint256 index)
        external
        view
        returns (uint256 score, uint256 maxCombo, bool won, uint256 timestamp)
    {
        Result storage result = results[player][index];
        return (result.score, result.maxCombo, result.won, result.timestamp);
    }
}
