// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity 0.8.27;

// HCU budget: 20M/tx, 5M depth.
// Wrapping/unwrapping touches encrypted balances + plaintext ERC-20 transfers
// in the same tx — keep flows small to stay within the per-tx budget.

import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/// @title {{NAME}} — confidential ERC-7984 wrapper around an ERC-20
/// @notice Wraps a plaintext ERC-20 into a confidential ERC-7984 token.
///         `wrap(amount)`   → pulls plaintext ERC-20 in, mints confidential balance.
///         `unwrap(handle)` → burns confidential balance, releases plaintext ERC-20.
/// @dev    `ZamaEthereumConfig` wires the FHE coprocessor at construction.
///         Note: pre-0.11 the export was named `SepoliaConfig`.
///         Underlying token decimals are inherited from the ERC-20; the wrapper
///         keeps balances confidential while preserving 1:1 redemption.
contract {{NAME}} is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    constructor(IERC20 underlying_, string memory name_, string memory symbol_, string memory uri_)
        ERC7984ERC20Wrapper(underlying_)
        ERC7984(name_, symbol_, uri_)
    {}

{{STATE_DECLS}}

{{SETTERS}}

{{GETTERS}}
}
