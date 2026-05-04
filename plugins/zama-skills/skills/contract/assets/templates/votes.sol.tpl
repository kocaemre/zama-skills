// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity 0.8.27;

// HCU budget: 20M/tx, 5M depth.
// Heavy loops + nested FHE.select can exceed; use `pnpm gas-report` to profile.

import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
// `ZamaEthereumConfig` wires the FHE coprocessor at construction (renamed from `SepoliaConfig` in @fhevm/solidity 0.11.x).
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {VotesConfidential} from "@openzeppelin/confidential-contracts/governance/VotesConfidential.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title {{NAME}} — confidential governance / votes contract
/// @notice Concrete subclass of OpenZeppelin's `VotesConfidential` with an
///         in-contract balance ledger as the voting-unit source. Replace
///         `_balances` + `_getVotingUnits` with whatever fits your app
///         (e.g. delegate to an ERC7984 token's confidential balance).
/// @dev    Decryption path: {{DECRYPTION_PATH}}.
contract {{NAME}} is VotesConfidential, ZamaEthereumConfig {
    /// Per-account voting power, kept encrypted on-chain.
    mapping(address account => euint64 votingUnits) private _balances;

{{STATE_DECLS}}

    /// @param name_    EIP-712 / VotesConfidential domain name (e.g. "{{NAME}}")
    /// @param version_ EIP-712 / VotesConfidential domain version (e.g. "1")
    constructor(string memory name_, string memory version_) EIP712(name_, version_) {}

    /// VotesConfidential hooks into this to read an account's voting power.
    /// Default returns the on-contract balance; override if you delegate to
    /// an ERC7984 token or another source of encrypted votes.
    function _getVotingUnits(address account) internal view virtual override returns (euint64) {
        return _balances[account];
    }

{{SETTERS}}

{{GETTERS}}
}
