const ethers = require("ethers");
require("dotenv").config();
const cngnabi = require('./cngnabi');
const abi = require('./abi');

const execute = async () => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_MAINNET);
        
        // Use environment variables for private keys instead of hardcoded values
        // SECURITY NOTE: Never commit actual private keys to source control
        // For testing, use dedicated test accounts with no real funds
        const userPrivateKey = process.env.USER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001"; // Default to a known test private key
        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000002"; // Default to a known test private key
        
        const signer = new ethers.Wallet(userPrivateKey, provider);
        const signer2 = new ethers.Wallet(adminPrivateKey, provider);
        
        console.log("Using addresses - User:", signer.address, "Admin:", signer2.address);
        
        const parsedAmount = ethers.utils.parseUnits("5000000", 6);
        const functionArgs = [parsedAmount, ""];

        const tokenContract = new ethers.Contract(process.env.CNGN_CONTRACT, cngnabi.cngnabi, signer);

        const encodeFunctionData = tokenContract.interface.encodeFunctionData("mint", functionArgs);

        const executeContract = new ethers.Contract(process.env.FORWARDER_CONTRACT, abi.executeabi, signer2);
        console.log(encodeFunctionData);

        // Get the current nonce from the Forwarder contract for meta-transaction
        const currentNonce = await executeContract.getNonce(signer.address);
        console.log("Current meta-tx nonce for", signer.address, ":", currentNonce.toString());
        
        // Create the meta-transaction request object
        const Req = {
            from: signer.address,
            to: process.env.CNGN_CONTRACT,
            value: 0,
            gas: 3000000,
            nonce: currentNonce,
            data: encodeFunctionData
        };
        
        console.log("Meta-transaction request created with target contract:", process.env.CNGN_CONTRACT);

        // Create the message hash that needs to be signed (must match the contract's implementation)
        const message = ethers.utils.solidityKeccak256(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'bytes'],
            [Req.from, Req.to, Req.value, Req.gas, Req.nonce, Req.data]
        );

        const arrayifyMessage = ethers.utils.arrayify(message);
        const flatSignature = await signer.signMessage(arrayifyMessage);
        console.log("Generated signature:", flatSignature);
        
        // Verify the signature is valid before submitting the transaction
        const isValid = await executeContract.verify(Req, flatSignature);
        console.log("Signature verification result:", isValid);
        
        if (!isValid) {
            throw new Error("Signature verification failed. Check that the contract and message format match.");
        }
        
        console.log("Executing meta-transaction...");
        const tx = await executeContract.execute(Req, flatSignature);
        console.log("Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        
        // Verify the nonce was incremented correctly after the transaction
        const newNonce = await executeContract.getNonce(signer.address);
        console.log("New nonce after transaction:", newNonce.toString());
        
        if (newNonce.toString() !== (parseInt(currentNonce.toString()) + 1).toString()) {
            console.warn("Warning: Nonce may not have incremented correctly!");
        } else {
            console.log("Nonce incremented correctly ✓");
        }
    } catch (error) {
        console.log('Error executing transaction:', error);
    }
};

execute();
