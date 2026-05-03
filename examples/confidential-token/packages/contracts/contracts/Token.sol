// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity 0.8.27;

// HCU budget: 20M/tx, 5M depth.
// Heavy loops + nested FHE.select can exceed; use `pnpm gas-report` to profile.

import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title Token — confidential ERC-7984 token
/// @notice Extends OpenZeppelin's ERC7984 base. Decryption path: user.
/// @dev    `ZamaEthereumConfig` wires the FHE coprocessor at construction.
///         Note: pre-0.11 the export was named `SepoliaConfig`.
contract Token is ERC7984, ZamaEthereumConfig {
    /// @notice Per-call faucet cap so a single tx cannot mint an absurd amount.
    /// @dev    100 token-units * 10^6 decimals (decimals() = 6 default).
    uint64 public constant FAUCET_CAP = 100_000_000;

    constructor(string memory name_, string memory symbol_, string memory uri_)
        ERC7984(name_, symbol_, uri_)
    {}

    /// @notice Faucet — mint up to FAUCET_CAP plaintext units to the caller.
    /// @dev    Demo only: anyone may call. The cleartext `amount` is encrypted
    ///         on-chain via `FHE.asEuint64` so the resulting balance update
    ///         participates in the confidential ledger like any other transfer.
    /// @param  amount  cleartext token-units (must be ≤ FAUCET_CAP)
    function mint(uint64 amount) external {
        require(amount > 0, "Token: amount=0");
        require(amount <= FAUCET_CAP, "Token: above FAUCET_CAP");
        _mint(msg.sender, FHE.asEuint64(amount));
    }
}
