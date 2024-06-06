const ethers = require("ethers");
require("dotenv").config();
const cngnabi = require('./cngnabi');
const abi = require('./abi');

const execute = async () => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_MAINNET);
        const userPrivateKey = "userpk";
        const signer = new ethers.Wallet(userPrivateKey, provider);
        const signer2 = new ethers.Wallet("adminpk", provider);
        
        const parsedAmount = ethers.utils.parseUnits("5000000", 6);
        const functionArgs = [parsedAmount, "0x1333946C8F7e30A74f6934645188bf75A13688Be"];

        const tokenContract = new ethers.Contract(process.env.CNGN_CONTRACT, cngnabi.cngnabi, signer);

        const encodeFunctionData = tokenContract.interface.encodeFunctionData("mint", functionArgs);

        const executeContract = new ethers.Contract(process.env.FORWARDER_CONTRACT, abi.executeabi, signer2);
        console.log(encodeFunctionData);

        // const nonce = await provider.getTransactionCount("0xa440B83cB40dC60774da908cC453F8acCda591Ca");

       // console.log("nonce:: ", nonce);
        const Req = {
            from: signer.address,
            to: process.env.CNGN_CONTRACT,
            value: 0,
            gas: 3000000,
            nonce: await executeContract.getNonce(signer.address), //
            data: encodeFunctionData
        };

        const message = ethers.utils.solidityKeccak256(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'bytes'],
            [Req.from, Req.to, Req.value, Req.gas, Req.nonce, Req.data]
        );

        const arrayifyMessage = ethers.utils.arrayify(message);
        const flatSignature = await signer.signMessage(arrayifyMessage);
        console.log(flatSignature);
        console.log(await executeContract.verify(Req, flatSignature))
        const tx = await executeContract.execute(Req, flatSignature);
        // console.log(tx);
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
    } catch (error) {
        console.log('Error executing transaction:', error);
    }
};

execute();
