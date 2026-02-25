// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Script.sol";
import "../src/Cngn3.sol";
import "../src/Operations2.sol";

contract MintCngnComplete is Script {
    // Replace these addresses with your deployed contract addresses
    address constant CNGN_ADDRESS = address(0); // TODO: Add your Cngn3 contract address
    address constant ADMIN_ADDRESS = address(0); // TODO: Add your Admin2 contract address
    
    // Configure these parameters
    address constant RECIPIENT_ADDRESS = address(0); // TODO: Add recipient address
    uint256 constant MINT_AMOUNT = 1000e6; // 1000 cNGN (6 decimals)

    function run() public {
        // Load the private key from environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        // Get contract instances
        Admin2 admin = Admin2(ADMIN_ADDRESS);
        Cngn3 cngn = Cngn3(CNGN_ADDRESS);

        // Step 1: Add deployer as minter
        console.log("Adding minter:", deployer);
        admin.addCanMint(deployer);
        console.log("Minter added successfully");

        // Step 2: Set the mint amount
        console.log("Setting mint amount:", MINT_AMOUNT);
        admin.addMintAmount(deployer, MINT_AMOUNT);
        console.log("Mint amount set successfully");

        // Step 3: Mint tokens to recipient
        console.log("Minting", MINT_AMOUNT, "to", RECIPIENT_ADDRESS);
        bool success = cngn.mint(MINT_AMOUNT, RECIPIENT_ADDRESS);
        require(success, "Mint failed");
        
        // Verify the mint
        uint256 balance = cngn.balanceOf(RECIPIENT_ADDRESS);
        uint256 totalSupply = cngn.totalSupply();
        
        console.log("=== Mint Summary ===");
        console.log("Recipient:", RECIPIENT_ADDRESS);
        console.log("Recipient balance:", balance);
        console.log("Total supply:", totalSupply);
        console.log("Mint successful!");

        vm.stopBroadcast();
    }
}
