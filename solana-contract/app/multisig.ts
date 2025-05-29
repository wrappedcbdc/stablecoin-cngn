import { web3 } from "@coral-xyz/anchor";
import { createMultisig } from "@solana/spl-token";
import * as anchor from '@coral-xyz/anchor';

export async function createMultiSig(signer1,signer2,signer3,payer){
      const connection = new web3.Connection("http://api.devnet.solana.com", "confirmed");
      // Configure the connection to the cluster
      const provider = new anchor.AnchorProvider(
        connection,
        anchor.Wallet.local(),
      );
      anchor.setProvider(provider);
    const multisigKey = await createMultisig(
        connection,
        payer,
        [
          signer1.publicKey,
          signer2.publicKey,
          signer3.publicKey
        ],
        2
      );
      
      console.log(`Created 2/3 multisig ${multisigKey.toBase58()}`);
     return multisigKey.toBase58()
}

