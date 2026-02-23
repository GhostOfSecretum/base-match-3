// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleStorage
 * @notice Minimal demo contract for the Base Match-3 "Deploy" menu.
 */
contract SimpleStorage {
    address public owner;
    uint256 public storedValue;

    event ValueChanged(uint256 newValue);

    constructor(address _owner) {
        owner = _owner;
        storedValue = 0;
    }

    function setValue(uint256 _value) external {
        require(msg.sender == owner, "NOT_OWNER");
        storedValue = _value;
        emit ValueChanged(_value);
    }

    function getValue() external view returns (uint256) {
        return storedValue;
    }
}

/**
 * @title SimpleStorageFactory
 * @notice Deploys `SimpleStorage` using CREATE2.
 * @dev This is designed to be allowlisted in CDP Paymaster:
 *      - Contract address = deployed SimpleStorageFactory address
 *      - Function signature = deploy(bytes32)
 *
 *      Then the frontend can send a normal contract call (to=this factory),
 *      which is typically eligible for sponsorship unlike raw contract creation.
 */
contract SimpleStorageFactory {
    event Deployed(address indexed deployer, address indexed contractAddress, bytes32 salt);

    function deploy(bytes32 salt) external returns (address deployed) {
        deployed = address(new SimpleStorage{salt: salt}(msg.sender));
        emit Deployed(msg.sender, deployed, salt);
    }
}

