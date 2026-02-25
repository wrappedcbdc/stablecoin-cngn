import { PublicKey } from "@solana/web3.js";
import { addCanMint } from "./admin/multisig/add-can-mint";
import { loadOrCreateKeypair } from "./utils/helpers";
import { updateMultisig } from "./admin/multisig/update-multisig";
import { MULTISIG_SIZE } from "@solana/spl-token";
import { setMintAmount } from "./admin/multisig";
import { mintTokens } from "./mint";
import { TOKEN_PARAMS } from "../utils/token_initializer";

async function main() {
    let target = loadOrCreateKeypair("NEW_USER");
    let recipient = loadOrCreateKeypair("NEW_USER3").publicKey;

    // await addCanMint(target.publicKey);
    // await setMintAmount(target.publicKey, TOKEN_PARAMS.mintAmount.toNumber());
    console.log("Minting tokensfrom", target.publicKey.toString(), "to", recipient.toString());
     await mintTokens(target,new PublicKey("6uibpu3qJLsxqP4He9nnaXcoSmkaWxgrkfK1j5qmtVVp"), TOKEN_PARAMS);
    //==== multisg threshold ====
    // const threshold = 2
    // const signer1 =new PublicKey(process.env.SIGNER_1)// loadOrCreateKeypair("MULTISIG_OWNER_1").publicKey
    // const signer2 =new PublicKey(process.env.SIGNER_2)// loadOrCreateKeypair("MULTISIG_OWNER_2").publicKey
    // console.log("signers are", signer1.toString(), signer2.toString())
    // const multisgOwners = [signer1, signer2]
     //await updateMultisig(multisgOwners, threshold)
}

if (require.main === module) {
    main()
        .then(() => {
            console.log("\n✓ Operation completed successfully");
            process.exit(0);
        })
        .catch((err) => {
            console.error("\n✗ Operation failed:", err);
            process.exit(1);
        });
}