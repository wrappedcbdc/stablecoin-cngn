import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Cngn } from '../../target/types/cngn';
import { TokenPDAs } from '../../utils/helpers';
import { TOKEN_PARAMS } from '../../utils/token_initializer';
import { Account } from '@solana/spl-token';


/**
 * Grant minting privilege to a user
 * @param pdas - The PDAs for the token
 * @param program - The anchor program instance
 * @param provider - The anchor provider instance
 * @param users - The user object containing the authorizedUser public key
 */
export async function giveUserMintingPriviledge(
    pdas: TokenPDAs,
    program: anchor.Program<Cngn>,
    provider: anchor.AnchorProvider,
    users: any
) {
    try {
        console.log("Adding minting privilege for user:", users.authorizedUser.publicKey.toString());
        const tx = await program.methods.addCanMint(users.authorizedUser.publicKey)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                blacklist: pdas.blacklist,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts

            } as any).rpc();

        console.log(`AddCanMint transaction: ${tx}`);
        program.addEventListener('whitelistedMinter', (event, slot) => {
            console.log("Added Minter address:", event.authority.toString());
            console.log("Token Mint address:", event.mint.toString());
        })
        return tx;
    } catch (error) {
        console.error("Error adding user mint privilege:", error);
        throw error;
    }
}

/**
 * Remove minting privilege from a user
 * @param pdas - The PDAs for the token
 * @param program - The anchor program
 * @param provider - The anchor provider
 * @param users - The user object containing the authorizedUser public key
 */
export async function removeUserMintingPriviledge(
    pdas: TokenPDAs,
    program: anchor.Program<Cngn>,
    provider: anchor.AnchorProvider,
    users: any
) {
    try {
        console.log("Removing minting privilege for user:", users.authorizedUser.publicKey.toString());
        const tx = await program.methods.removeCanMint(users.authorizedUser.publicKey)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            }as any).rpc();
        console.log(`RemoveCanMint transaction: ${tx}`);
        program.addEventListener('blackListedMinter', (event, slot) => {
            console.log("blacklisted Minter address:", event.authority.toString());
            console.log("Token Mint address:", event.mint.toString());
        })
        return tx;
    } catch (error) {
        console.error("Error removing user mint privilege:", error);
        throw error;
    }
}


export async function setMintAmountToPrivildegedUser(
    pdas: TokenPDAs,
    program: anchor.Program<Cngn>,
    provider: anchor.AnchorProvider,
    users: any
) {
    try {
        console.log("Setting mint amount to privileged user:", users.authorizedUser.publicKey.toString());
        const tx = await program.methods.setMintAmount(users.authorizedUser.publicKey,TOKEN_PARAMS.mintAmount)
            .accounts({
                authority: provider.wallet.publicKey,
                tokenConfig: pdas.tokenConfig,
                canMint: pdas.canMint,
                trustedContracts: pdas.trustedContracts
            } as any).rpc();
        console.log(`RemoveCanMint transaction: ${tx}`);
        program.addEventListener('blackListedMinter', (event, slot) => {
            console.log("blacklisted Minter address:", event.authority.toString());
            console.log("Token Mint address:", event.mint.toString());
        })
        return tx;
    } catch (error) {
        console.error("Error removing user mint privilege:", error);
        throw error;
    }
}