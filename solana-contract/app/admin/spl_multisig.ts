
import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';

import {
    TOKEN_2022_PROGRAM_ID,
    createMultisig
} from '@solana/spl-token';




export async function createSPLMultisig(
    provider: anchor.AnchorProvider,
    payer: Keypair,
    splKeypair: Keypair,
    signers: PublicKey[],
    threshold: number,
   
): Promise<

    anchor.web3.PublicKey
> {

    const splMultisigAddress = await createMultisig(provider.connection, payer, signers, threshold, splKeypair, null, TOKEN_2022_PROGRAM_ID);
    return splMultisigAddress
}