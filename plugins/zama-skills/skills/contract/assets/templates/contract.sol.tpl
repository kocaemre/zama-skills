// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity 0.8.27;

// HCU budget: 20M/tx, 5M depth.
// Heavy loops + nested FHE.select can exceed; use `pnpm gas-report` to profile.

import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
// `ZamaEthereumConfig` wires the FHE coprocessor at construction (renamed from `SepoliaConfig` in @fhevm/solidity 0.11.x).
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
{{OWNABLE_IMPORT}}

contract {{NAME}} is ZamaEthereumConfig{{OWNABLE_INHERITS}} {
{{STATE_DECLS}}

{{SETTERS}}

{{GETTERS}}
}
