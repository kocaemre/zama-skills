{
  "name": "contracts",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "coverage": "hardhat coverage",
    "clean": "hardhat clean && rimraf typechain-types dist",
    "lint": "solhint 'contracts/**/*.sol' && prettier --check 'contracts/**/*.sol'"
  },
  "dependencies": {
    "@fhevm/solidity": "<!-- @pin:@fhevm/solidity -->",
    "@openzeppelin/confidential-contracts": "<!-- @pin:@openzeppelin/confidential-contracts -->",
    "@openzeppelin/contracts": "<!-- @pin:@openzeppelin/contracts -->",
    "encrypted-types": "<!-- @pin:encrypted-types -->"
  },
  "devDependencies": {
    "_comment_typescript": "typescript pinned to ^5.9.3 — top-level key in pinned-versions.json (no @pin: placeholder)",
    "typescript": "^5.9.3",
    "@fhevm/hardhat-plugin": "<!-- @pin:@fhevm/hardhat-plugin -->",
    "@fhevm/mock-utils": "<!-- @pin:@fhevm/mock-utils -->",
    "@fhevm/host-contracts": "<!-- @pin:@fhevm/host-contracts -->",
    "@zama-fhe/relayer-sdk": "<!-- @pin:@zama-fhe/relayer-sdk-dev -->",
    "hardhat": "<!-- @pin:hardhat -->",
    "ethers": "<!-- @pin:ethers -->",
    "@nomicfoundation/hardhat-ethers": "<!-- @pin:@nomicfoundation/hardhat-ethers -->",
    "@nomicfoundation/hardhat-chai-matchers": "<!-- @pin:@nomicfoundation/hardhat-chai-matchers -->",
    "@nomicfoundation/hardhat-network-helpers": "<!-- @pin:@nomicfoundation/hardhat-network-helpers -->",
    "@nomicfoundation/hardhat-verify": "<!-- @pin:@nomicfoundation/hardhat-verify -->",
    "hardhat-deploy": "<!-- @pin:hardhat-deploy -->",
    "hardhat-gas-reporter": "<!-- @pin:hardhat-gas-reporter -->",
    "solidity-coverage": "<!-- @pin:solidity-coverage -->",
    "@typechain/ethers-v6": "<!-- @pin:@typechain/ethers-v6 -->",
    "@typechain/hardhat": "<!-- @pin:@typechain/hardhat -->",
    "typechain": "<!-- @pin:typechain -->",
    "dotenv": "<!-- @pin:dotenv -->",
    "cross-env": "<!-- @pin:cross-env -->",
    "mocha": "<!-- @pin:mocha -->",
    "chai": "<!-- @pin:chai -->",
    "chai-as-promised": "<!-- @pin:chai-as-promised -->",
    "rimraf": "<!-- @pin:rimraf -->",
    "solhint": "<!-- @pin:solhint -->",
    "prettier-plugin-solidity": "<!-- @pin:prettier-plugin-solidity -->",
    "prettier": "<!-- @pin:prettier -->",
    "eslint": "<!-- @pin:eslint -->",
    "typescript-eslint": "<!-- @pin:typescript-eslint -->"
  }
}
