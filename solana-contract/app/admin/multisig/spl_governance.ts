/**
 * SPL Governance Admin Change Flow
 * Perfect for HSM setups - members can vote asynchronously
 */

import * as anchor from "@coral-xyz/anchor";
import {
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import {
    getGovernanceProgramVersion,
    withCreateRealm,
    withDepositGoverningTokens,
    withCreateGovernance,
    withCreateProposal,
    withAddSignatory,
    withInsertTransaction,
    withSignOffProposal,
    withCastVote,
    Vote,
    VoteType,
    getTokenOwnerRecordAddress,
    getRealmAddress,
    GovernanceConfig,
    MintMaxVoteWeightSource,
    VoteTipping,
    getGovernanceAddress,
    getProposalAddress,
    withExecuteTransaction,
    YesNoVote,
} from "@solana/spl-governance";
import { program } from "@coral-xyz/anchor/dist/cjs/native/system";
import { web3 } from "@coral-xyz/anchor";
import cngnidl from '../../../target/idl/cngn.json';
import { loadOrCreateKeypair } from "../../utils/helpers";
import nacl from "tweetnacl";
// =============================================================================
// CONFIGURATION
// =============================================================================

const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID");
const SPL_GOVERNANCE_PROGRAM_ID = new PublicKey(
    "GovER5Lthms3tLwQn5LCH7FieKSUqCJdg7vctTpsPmjgL"
);

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const connection = provider.connection;

// =============================================================================
// STEP 1: CREATE REALM (ONE-TIME SETUP)
// =============================================================================

/**
 * Creates a governance realm with council members
 * Run this once to set up your governance structure
 */
async function setupGovernanceRealm(
    councilMembers: PublicKey[], // Your HSM public keys
    realmName: string = "Token Admin Council"
) {
    console.log("🏛️  Setting up SPL Governance Realm");
    console.log("Council members:", councilMembers.length);

    const instructions: TransactionInstruction[] = [];
    const payer = provider.wallet.publicKey;

    // Create council token (represents voting power)
    const councilTokenMint = anchor.web3.Keypair.generate();

    // Create realm
    const realmAddress = await getRealmAddress(
        SPL_GOVERNANCE_PROGRAM_ID,
        realmName
    );

    await withCreateRealm(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        realmName,
        payer,
        councilTokenMint.publicKey,
        payer,
        undefined, // No community mint (council-only governance)
        MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
        new anchor.BN(1) as any,
        undefined
    );

    // Send realm creation
    const tx = new Transaction().add(...instructions);
    const sig = await provider.sendAndConfirm(tx, [councilTokenMint]);

    console.log("✅ Realm created:", realmAddress.toBase58());
    console.log("Transaction:", sig);

    // Mint council tokens to members (1 token = 1 vote)
    for (const member of councilMembers) {
        await depositCouncilTokens(
            realmAddress,
            councilTokenMint.publicKey,
            member,
            new anchor.BN(1) // 1 vote per member
        );
    }

    console.log("✅ Council tokens distributed");

    return {
        realmAddress,
        councilTokenMint: councilTokenMint.publicKey,
    };
}

async function depositCouncilTokens(
    realmAddress: PublicKey,
    councilMint: PublicKey,
    memberPubkey: PublicKey,
    amount: anchor.BN
) {
    const instructions: TransactionInstruction[] = [];

    const tokenOwnerRecord = await getTokenOwnerRecordAddress(
        SPL_GOVERNANCE_PROGRAM_ID,
        realmAddress,
        councilMint,
        memberPubkey
    );

await withDepositGoverningTokens(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        realmAddress,
        councilMint,
        memberPubkey, // governingTokenSource (Council Token Account)
        councilMint, // governingTokenMint
        memberPubkey, // governingTokenOwner
        memberPubkey, // governingTokenSourceAuthority (Token Account Owner)
        memberPubkey, // <<-- ADDED PAYER (Pays for Token Owner Record/Token Account)
        amount
    );

    const tx = new Transaction().add(...instructions);
    await provider.sendAndConfirm(tx);

    console.log(`✅ Deposited to ${memberPubkey.toBase58().slice(0, 8)}...`);
}

// =============================================================================
// STEP 2: CREATE GOVERNANCE ACCOUNT (ONE-TIME)
// =============================================================================

/**
 * Creates a governance account that will be the admin
 * This PDA has specific voting rules (threshold, timelock, etc.)
 */
async function createGovernanceAccount(
    realmAddress: PublicKey,
    councilMint: PublicKey,
    governedAccount: PublicKey, // Your TokenConfig PDA
    config: {
        minCommunityTokensToCreateProposal: anchor.BN;
        minCouncilTokensToCreateProposal: anchor.BN;
        minInstructionHoldUpTime: number; // seconds
        maxVotingTime: number; // seconds
        voteTipping: VoteTipping; // early execution rules
        councilVoteThreshold: number; // percentage (0-100)
    }
) {
    console.log("🏛️  Creating Governance Account");

    const instructions: TransactionInstruction[] = [];
    const payer = provider.wallet.publicKey;

    const governanceConfig = new GovernanceConfig({
        communityVoteThreshold: { disabled: {} }, // No community voting
        minCommunityTokensToCreateProposal: config.minCommunityTokensToCreateProposal,
        minCouncilTokensToCreateProposal: config.minCouncilTokensToCreateProposal,
        minInstructionHoldUpTime: config.minInstructionHoldUpTime,
        maxVotingTime: config.maxVotingTime,
        communityVoteTipping: VoteTipping.Disabled,
        councilVoteTipping: config.voteTipping,
        communityVetoVoteThreshold: { disabled: {} },
        councilVetoVoteThreshold: { disabled: {} },
        minTransactionHoldUpTime: 0, // Immediate execution after passing
        councilVoteThreshold: {
            yesVotePercentage: [config.councilVoteThreshold, 100], // e.g., [60, 100] = 60%
        },
    });

    const governanceAddress = await getGovernanceAddress(
        SPL_GOVERNANCE_PROGRAM_ID,
        realmAddress,
        governedAccount
    );

    await withCreateGovernance(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        realmAddress,
        governedAccount,
        governanceConfig,
        undefined, // No token owner record (anyone can create proposals)
        payer,
        payer,
        councilMint
    );

    const tx = new Transaction().add(...instructions);
    const sig = await provider.sendAndConfirm(tx);

    console.log("✅ Governance created:", governanceAddress.toBase58());
    console.log("Transaction:", sig);
    console.log("\n🔑 THIS IS YOUR NEW ADMIN ADDRESS - Update TokenConfig.admin to this PDA");

    return governanceAddress;
}

// =============================================================================
// STEP 3: CREATE PROPOSAL (ANY COUNCIL MEMBER OR ANYONE IF ALLOWED)
// =============================================================================

/**
 * Creates a proposal to change admin
 * Can be run by anyone if governance allows, or restricted to council
 */
async function createAdminChangeProposal(
    realmAddress: PublicKey,
    governanceAddress: PublicKey,
    councilMint: PublicKey,
    proposer: PublicKey,
    newAdmin: PublicKey,
    tokenConfigPDA: PublicKey,
    programId: PublicKey
) {
    console.log("📝 Creating Admin Change Proposal");

    const instructions: TransactionInstruction[] = [];
    const payer = proposer;

    // Get proposer's token owner record
    const tokenOwnerRecord = await getTokenOwnerRecordAddress(
        SPL_GOVERNANCE_PROGRAM_ID,
        realmAddress,
        councilMint,
        proposer
    );

    // Create proposal
    const proposalAddress = await getProposalAddress(
        SPL_GOVERNANCE_PROGRAM_ID,
        governanceAddress,
        councilMint,
        new anchor.BN(Date.now()) // Use timestamp as seed for uniqueness
    );

    await withCreateProposal(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        realmAddress,
        governanceAddress,
        tokenOwnerRecord,
        "Change Token Admin",
        `Change admin from ${governanceAddress.toBase58()} to ${newAdmin.toBase58()}`,
        councilMint,
        payer,
        0, // proposalIndex
        VoteType.SINGLE_CHOICE,
        ["Approve"], // Single option
        true, // useDenyOption
        payer,
        undefined // No vote instructions
    );

    // Add the actual instruction to execute
    const program = new anchor.Program(cngnidl, provider);

    const changeAdminIx = await program.methods
        .changeAdmin(newAdmin)
        .accounts({
            tokenConfig: tokenConfigPDA,
            authority: governanceAddress, // The governance PDA is the authority
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .instruction();

    await withInsertTransaction(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        governanceAddress,
        proposalAddress,
        tokenOwnerRecord,
        payer,
        0, // optionIndex
        0, // transactionIndex
        0, // holdUpTime (can execute immediately after passing)
        [changeAdminIx]
    );

    // Sign off to make proposal votable
    await withSignOffProposal(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        realmAddress,
        governanceAddress,
        proposalAddress,
        proposer,
        undefined, // No signatories needed
        undefined // proposal owner record needed
    );

    const tx = new Transaction().add(...instructions);
    const sig = await provider.sendAndConfirm(tx);

    console.log("✅ Proposal created:", proposalAddress.toBase58());
    console.log("Transaction:", sig);
    console.log("\n📋 Share this proposal address with HSM members for voting");

    return proposalAddress;
}

// =============================================================================
// STEP 4: VOTE (EACH HSM MEMBER RUNS THIS)
// =============================================================================

/**
 * Cast vote on proposal - UNSIGNED VERSION
 * Returns transaction for HSM to sign
 * Each HSM member runs this independently
 * 
 * @param feePayer - Separate wallet that pays transaction fees (NOT the HSM)
 */
async function buildVoteTransaction(
    realmAddress: PublicKey,
    governanceAddress: PublicKey,
    proposalAddress: PublicKey,
    councilMint: PublicKey,
    voter: PublicKey,
    voteChoice: YesNoVote,
    feePayer: PublicKey // ← Separate fee payer wallet
): Promise<Transaction> {
    console.log("🗳️  Building Vote Transaction");
    console.log("Voter (HSM):", voter.toBase58());
    console.log("Fee payer:", feePayer.toBase58());

    const instructions: TransactionInstruction[] = [];

    const tokenOwnerRecord = await getTokenOwnerRecordAddress(
        SPL_GOVERNANCE_PROGRAM_ID,
        realmAddress,
        councilMint,
        voter
    );

    await withCastVote(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        realmAddress,
        governanceAddress,
        proposalAddress,
        tokenOwnerRecord,
        tokenOwnerRecord,
        voter,
        councilMint,
        Vote.fromYesNoVote(voteChoice),
        voter
    );

    // Build transaction WITHOUT signing
    const tx = new Transaction().add(...instructions);
    tx.feePayer = feePayer; // Separate wallet pays fees
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    console.log("✅ Transaction built (unsigned)");
    return tx;
}

/**
 * Cast vote with HSM signing + separate fee payer
 * HSM signs as voter, fee payer signs and pays for the transaction
 */
async function castVoteWithHSM(
    realmAddress: PublicKey,
    governanceAddress: PublicKey,
    proposalAddress: PublicKey,
    councilMint: PublicKey,
    hsmSigner: PublicKey,
    voteChoice: YesNoVote,
    feePayer: Keypair,
    memberWho: Number
) {
    // Build unsigned transaction
    const tx = await buildVoteTransaction(
        realmAddress,
        governanceAddress,
        proposalAddress,
        councilMint,
        hsmSigner,
        voteChoice,
        feePayer.publicKey // Separate fee payer
    );

    console.log("🔐 Signing with HSM (voter)...");

    console.log("💰 Signing with fee payer...");

    // HSM signs FIRST
    const hsmSignedTx = await awsKMSTestCase(tx, memberWho);

    // Fee payer signs SECOND (pays fees)
    const fullySignedTx = new web3.Transaction().add(hsmSignedTx);
    fullySignedTx.feePayer = feePayer.publicKey;
    fullySignedTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const createProposalSig = await connection.sendTransaction(fullySignedTx, [feePayer]);
    await connection.confirmTransaction(createProposalSig);
    console.log("Proposal created:", createProposalSig);
    console.log("📤 Sending transaction...");


    console.log("✅ Vote recorded:", createProposalSig);
    return createProposalSig;
}

// =============================================================================
// STEP 5: EXECUTE (AFTER VOTING PERIOD + THRESHOLD MET)
// =============================================================================

/**
 * Execute the proposal
 * Can be run by anyone after voting succeeds
 */
async function executeProposal(
    governanceAddress: PublicKey,
    proposalAddress: PublicKey
) {
    console.log("⚡ Executing Proposal");

    const instructions: TransactionInstruction[] = [];

    await withExecuteTransaction(
        instructions,
        SPL_GOVERNANCE_PROGRAM_ID,
        await getGovernanceProgramVersion(connection, PROGRAM_ID),
        governanceAddress,
        proposalAddress,
        0, // transactionIndex
        provider.wallet.publicKey
    );

    const tx = new Transaction().add(...instructions);
    const sig = await provider.sendAndConfirm(tx);

    console.log("✅ Proposal executed:", sig);
    console.log("🎉 Admin has been changed!");
}

async function awsKMSTestCase(tx, memberWho): Promise<Transaction> {
let secretKey:Keypair
    if (memberWho == 0) {
          secretKey = loadOrCreateKeypair("MEMBER_1");
    }
    else{
        secretKey = loadOrCreateKeypair("MEMBER_2");
    }
        // Set the recent blockhash and fee payer
        tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;

        // Sign the transaction with the payer and additional signers
        tx.sign(secretKey);

        // Serialize and send raw transaction
        const rawTx = tx.serialize();

        return rawTx;
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

async function fullWorkflowExample() {
    let feePayer: Keypair = loadOrCreateKeypair("FEE_PAYER");
    let member1 = loadOrCreateKeypair("MEMBER_1");
    let member2 = loadOrCreateKeypair("MEMBER_2");
    // HSM member public keys
    const hsmMembers = [
        member1.publicKey,
        member2.publicKey
    ];

    // STEP 1: One-time setup
    const { realmAddress, councilTokenMint } = await setupGovernanceRealm(
        hsmMembers,
        "CNGN Admin Council"
    );

    // STEP 2: Create governance account (this becomes your admin)
    const tokenConfigPDA = new PublicKey("YOUR_TOKEN_CONFIG_PDA");

    const governanceAddress = await createGovernanceAccount(
        realmAddress,
        councilTokenMint,
        tokenConfigPDA,
        {
            minCommunityTokensToCreateProposal: new anchor.BN(0),
            minCouncilTokensToCreateProposal: new anchor.BN(1),
            minInstructionHoldUpTime: 0, // No timelock
            maxVotingTime: 86400 * 3, // 3 days
            voteTipping: VoteTipping.Early, // Execute as soon as threshold met
            councilVoteThreshold: 67, // 67% approval needed
        }
    );

    console.log("\n🔧 Now update your TokenConfig:");
    console.log(`   token_config.admin = ${governanceAddress.toBase58()}`);
    console.log("\nThen continue with proposals...\n");

    // STEP 3: Create proposal (any member)
    const newAdmin = new PublicKey("NEW_ADMIN_PUBKEY");

    const proposalAddress = await createAdminChangeProposal(
        realmAddress,
        governanceAddress,
        councilTokenMint,
        hsmMembers[0], // Proposer
        newAdmin,
        tokenConfigPDA,
        PROGRAM_ID
    );

    // STEP 4: Each HSM votes (asynchronously)
    // HSM Member 1:
    await castVoteWithHSM(
        realmAddress,
        governanceAddress,
        proposalAddress,
        councilTokenMint,
        hsmMembers[0],
        YesNoVote.Yes,
        feePayer,
        0
    );

    // HSM Member 2:
    await castVoteWithHSM(
        realmAddress,
        governanceAddress,
        proposalAddress,
        councilTokenMint,
        hsmMembers[1],
        YesNoVote.Yes,
        feePayer,
        1

    );

    // STEP 5: Execute (anyone, after threshold met)
    await executeProposal(governanceAddress, proposalAddress);
}

export {
    setupGovernanceRealm,
    createGovernanceAccount,
    createAdminChangeProposal,
    buildVoteTransaction,
    castVoteWithHSM,
    executeProposal,
};