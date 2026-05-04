// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// BUG: deprecated import — should be @fhevm/solidity
import "fhevm/lib/TFHE.sol";

contract DeprecatedSol {
    function noop() external pure {}
}
