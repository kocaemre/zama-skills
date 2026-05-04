// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";

contract CleartextBug {
    mapping(address => euint64) public balance;

    event Transferred(address indexed from, address indexed to, uint256 amount);
    event Decoded(uint256 plain);

    // BUG: require with decrypted value in revert message
    function withdraw(uint256 plain) external {
        require(plain > 0, "balance must be positive");
        // simulating leak: emit a value that came from decrypt
        uint256 decrypted = FHE.decrypt(balance[msg.sender]);
        emit Decoded(decrypted);
    }

    // BUG: emit with decrypted amount
    function leakAmount() external {
        uint256 amount = FHE.decrypt(balance[msg.sender]);
        emit Transferred(msg.sender, address(0), amount);
    }
}
