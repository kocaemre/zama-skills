// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity 0.8.27;

// HCU budget: 20M/tx, 5M depth.
// Heavy loops + nested FHE.select can exceed; use `pnpm gas-report` to profile.

import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
// `ZamaEthereumConfig` wires the FHE coprocessor at construction (renamed from `SepoliaConfig` in @fhevm/solidity 0.11.x).
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {VotesConfidential} from "@openzeppelin/confidential-contracts/governance/VotesConfidential.sol";

/// @title {{NAME}} — confidential governance / votes contract
/// @notice Extends OpenZeppelin's VotesConfidential base. Decryption path: {{DECRYPTION_PATH}}.
abstract contract {{NAME}} is VotesConfidential, ZamaEthereumConfig {
{{STATE_DECLS}}

{{SETTERS}}

{{GETTERS}}
}
