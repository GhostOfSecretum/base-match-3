// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GMContract
 * @notice Simple contract for gasless GM transactions on Base
 * @dev Users call sayGM() to record their GM on-chain
 */
contract GMContract {
    // Events
    event GM(address indexed sender, uint256 timestamp, uint256 streak);
    
    // Mapping to track last GM timestamp per user
    mapping(address => uint256) public lastGMTimestamp;
    
    // Mapping to track GM streak per user
    mapping(address => uint256) public gmStreak;
    
    // Total GM count
    uint256 public totalGMs;
    
    /**
     * @notice Say GM on-chain
     * @dev This is the main function users call - can be sponsored via paymaster
     */
    function sayGM() external {
        uint256 currentTime = block.timestamp;
        uint256 lastTime = lastGMTimestamp[msg.sender];
        
        // Check if this is a new day (24 hours since last GM)
        if (lastTime > 0 && currentTime - lastTime < 24 hours) {
            // Already said GM today - but we still allow it
        }
        
        // Update streak
        if (lastTime == 0) {
            // First GM ever
            gmStreak[msg.sender] = 1;
        } else if (currentTime - lastTime < 48 hours) {
            // Within 48 hours - continue streak
            gmStreak[msg.sender]++;
        } else {
            // Streak broken - reset to 1
            gmStreak[msg.sender] = 1;
        }
        
        // Update timestamp
        lastGMTimestamp[msg.sender] = currentTime;
        
        // Increment total
        totalGMs++;
        
        // Emit event
        emit GM(msg.sender, currentTime, gmStreak[msg.sender]);
    }
    
    /**
     * @notice Get user's GM data
     * @param user Address to check
     * @return lastTimestamp Last GM timestamp
     * @return streak Current streak
     */
    function getGMData(address user) external view returns (uint256 lastTimestamp, uint256 streak) {
        return (lastGMTimestamp[user], gmStreak[user]);
    }
    
    /**
     * @notice Check if user can say GM today (hasn't said in last 24h)
     * @param user Address to check
     * @return canSay True if user hasn't said GM in last 24 hours
     */
    function canSayGMToday(address user) external view returns (bool canSay) {
        uint256 lastTime = lastGMTimestamp[user];
        if (lastTime == 0) return true;
        return (block.timestamp - lastTime) >= 24 hours;
    }
}
