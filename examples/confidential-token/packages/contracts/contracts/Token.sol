// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity 0.8.27;

// HCU budget: 20M/tx, 5M depth.
// Heavy loops + nested FHE.select can exceed; use `pnpm gas-report` to profile.

import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984.sol";

/// @title Token — confidential ERC-7984 token
/// @notice Extends OpenZeppelin's ERC7984 base. Decryption path: user.
contract Token is ERC7984, SepoliaConfig {
    constructor(string memory name_, string memory symbol_, string memory uri_)
        ERC7984(name_, symbol_, uri_)
    {}

    // No state schema.

    // No setters generated.

    // No getters generated.
}
