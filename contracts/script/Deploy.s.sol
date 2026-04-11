// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/TournamentPool.sol";

contract DeployScript is Script {
    function run() external {
        // Operator = the deployer (backend signer)
        // Platform = same address for now (rake recipient)
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");

        vm.startBroadcast();

        TournamentPool pool = new TournamentPool(deployer, deployer);
        console.log("TournamentPool deployed at:", address(pool));

        vm.stopBroadcast();
    }
}
