// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract Clean {
    mapping(address => euint64) public balance;

    function setBalance(address user, euint64 amount) external {
        balance[user] = amount;
        FHE.allowThis(balance[user]);
        FHE.allow(balance[user], user);
    }

    function getBalance(address user) external returns (euint64) {
        FHE.allow(balance[user], msg.sender);
        return balance[user];
    }

    function add(euint64 a, euint64 b) external returns (euint64) {
        euint64 r = FHE.add(a, b);
        FHE.allow(r, msg.sender);
        return r;
    }
}
