// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";

contract AclBug {
    mapping(address => euint64) public balance;
    euint64 public total;

    // BUG: storage write without FHE.allowThis
    function setBalance(address user, euint64 amount) external {
        balance[user] = amount;
        // missing: FHE.allowThis(balance[user]);
    }

    // BUG: encrypted return without FHE.allow(value, msg.sender)
    function getBalance(address user) external view returns (euint64) {
        return balance[user];
        // missing: FHE.allow(balance[user], msg.sender);
    }

    // BUG: another storage write without grant
    function setTotal(euint64 newTotal) external {
        total = newTotal;
    }
}
