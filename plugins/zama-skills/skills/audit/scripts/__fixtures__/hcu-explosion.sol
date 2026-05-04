// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";

contract HcuExplosion {
    // 22 FHE ops in one function — should ERROR (>20)
    function bigPipeline(euint64 a, euint64 b, euint64 c) external returns (euint64) {
        euint64 x1 = FHE.add(a, b);
        euint64 x2 = FHE.add(x1, c);
        euint64 x3 = FHE.sub(x2, a);
        euint64 x4 = FHE.mul(x3, b);
        euint64 x5 = FHE.add(x4, x1);
        euint64 x6 = FHE.sub(x5, x2);
        euint64 x7 = FHE.mul(x6, x3);
        euint64 x8 = FHE.add(x7, x4);
        euint64 x9 = FHE.sub(x8, x5);
        euint64 x10 = FHE.mul(x9, x6);
        ebool b1 = FHE.lt(x10, a);
        ebool b2 = FHE.gt(x10, b);
        ebool b3 = FHE.le(x10, c);
        ebool b4 = FHE.ge(x10, a);
        ebool b5 = FHE.eq(x10, b);
        ebool b6 = FHE.ne(x10, c);
        ebool b7 = FHE.and(b1, b2);
        ebool b8 = FHE.or(b3, b4);
        ebool b9 = FHE.xor(b5, b6);
        ebool b10 = FHE.not(b7);
        euint64 r1 = FHE.select(b8, x10, a);
        euint64 r2 = FHE.select(b9, r1, b);
        return r2;
    }

    // 14 FHE ops — should WARNING (>12, <=20)
    function mediumPipeline(euint64 a, euint64 b) external returns (euint64) {
        euint64 x1 = FHE.add(a, b);
        euint64 x2 = FHE.sub(x1, a);
        euint64 x3 = FHE.mul(x2, b);
        euint64 x4 = FHE.add(x3, x1);
        euint64 x5 = FHE.sub(x4, x2);
        euint64 x6 = FHE.mul(x5, x3);
        euint64 x7 = FHE.add(x6, x4);
        ebool b1 = FHE.lt(x7, a);
        ebool b2 = FHE.gt(x7, b);
        ebool b3 = FHE.eq(x7, a);
        ebool b4 = FHE.and(b1, b2);
        ebool b5 = FHE.or(b3, b4);
        euint64 r1 = FHE.select(b4, x7, a);
        euint64 r2 = FHE.select(b5, r1, b);
        return r2;
    }

    // small function — under threshold
    function tiny(euint64 a, euint64 b) external returns (euint64) {
        return FHE.add(a, b);
    }
}
