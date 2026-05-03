// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

contract Counter {
    euint64 private _counter;

    function setCounter(externalEuint64 inputHandle, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(inputHandle, inputProof);
        _counter = amount;
        FHE.allowThis(_counter);
        FHE.allow(_counter, msg.sender);
    }

    function getCounter() external view returns (euint64) {
        return _counter;
    }
}
