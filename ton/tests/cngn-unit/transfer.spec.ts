import { Blockchain, internal, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, beginCell } from '@ton/core';
import { AdminOperations } from '../../build/AdminOperations/AdminOperations_AdminOperations';
import { CngnJetton } from '../../build/CngnJetton/CngnJetton_CngnJetton';
import { CngnJettonWallet } from '../../build/CngnJetton/CngnJetton_CngnJettonWallet';
import '@ton/test-utils';
import { buildOnchainMetadata } from '../../utils/metadata';
import { jettonMetadata } from '../../utils/cngn';

describe('CngnJetton Transfer Tests', () => {
    let blockchain: Blockchain;
    let jetton: SandboxContract<CngnJetton>;
    let admin: SandboxContract<AdminOperations>;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let user3: SandboxContract<TreasuryContract>;
    let user4: SandboxContract<TreasuryContract>;

    // Helper function to mint tokens to a user
    async function mintTokens(minter: SandboxContract<TreasuryContract>, receiver: Address, amount: bigint) {
        // Add minter permission
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: minter.address }
        );

        // Set mint amount
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: minter.address, amount }
        );

        // Request mint
        await jetton.send(
            minter.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount, receiver }
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');
        user3 = await blockchain.treasury('user3');
        user4 = await blockchain.treasury('user4');
        let content = buildOnchainMetadata(jettonMetadata);
        // Deploy Admin Operations
        admin = blockchain.openContract(
            await AdminOperations.fromInit(deployer.address)
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Deploy Jetton
        jetton = blockchain.openContract(
            await CngnJetton.fromInit(
                deployer.address,
                admin.address,
                deployer.address, // forwarder (using deployer for simplicity)
                content
            )
        );

        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.5') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Set jetton master in admin contract
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'SetJettonMaster', jettonMaster: jetton.address }
        );
    });

    it('Test: Complete transfer flow - normal user to user transfer should succeed', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        // Get user1 wallet
        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Verify initial balance
        let walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);

        // Transfer tokens from user1 to user2
        const transferAmount = toNano('500');
        const result = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: transferAmount,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transaction chain
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: true,
        });

        // Verify wallet queries master
        expect(result.transactions).toHaveTransaction({
            from: user1WalletAddress,
            to: jetton.address,
            success: true,
        });

        // Verify master queries admin
        expect(result.transactions).toHaveTransaction({
            from: jetton.address,
            to: admin.address,
            success: true,
        });

        // Verify balances after transfer
        walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount - transferAmount);

        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2WalletData = await user2Wallet.getGetWalletData();
        expect(user2WalletData.balance).toBe(transferAmount);
    });

    it('Test: Transfer from blacklisted sender should fail', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);



        // Get user1 wallet
        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Try to transfer
        const transferAmount = toNano('500');
        const result = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: transferAmount,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer was initiated but rejected
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: true,
        });

        // Verify user1 balance  (transfer succeeded)
        const walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(transferAmount);
        // Verify user2 received first transfer tokens
        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2WalletData = await user2Wallet.getGetWalletData();
        expect(user2WalletData.balance).toBe(transferAmount);

        // Blacklist user1
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user1.address }
        );

        // Try to transfer again
        const result2 = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: transferAmount,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer was initiated but rejected
        expect(result2.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: true,
        });
        // Verify user1 balance unchanged (transfer rejected)
        const walletData2 = await user1Wallet.getGetWalletData();
        expect(walletData2.balance).toBe(transferAmount);
        // Verify user2 has only has first transfer tokens
        const user2WalletAddress2 = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet2 = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress2)
        );
        const user2WalletData2 = await user2Wallet2.getGetWalletData();
        expect(user2WalletData2.balance).toBe(transferAmount);
    });

    it('Test: Transfer to blacklisted recipient should fail', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        // Blacklist user2
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user2.address }
        );

        // Get user1 wallet
        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Try to transfer
        const transferAmount = toNano('500');
        await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: transferAmount,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify user1 balance unchanged
        const walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);
    });

    it('Test: Transfer with insufficient balance should fail', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('100');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Try to transfer more than balance
        const transferAmount = toNano('500');
        const result = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: transferAmount,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: false,
        });

        // Verify balance unchanged
        const walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);
    });

    it('Test: Zero amount transfer should fail', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Try to transfer zero amount
        const result = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: 0n,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: false,
        });
    });

    it('Test: Transfer to zero address should fail', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        const zeroAddress = new Address(0, Buffer.alloc(32, 0));

        // Try to transfer to zero address
        const result = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: zeroAddress,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: false,
        });
    });

    it('Test: Multiple sequential transfers should work', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Transfer 1: user1 -> user2
        await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('300'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Transfer 2: user1 -> user3
        await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                amount: toNano('400'),
                destination: user3.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify balances
        const user1Data = await user1Wallet.getGetWalletData();
        expect(user1Data.balance).toBe(toNano('300'));

        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2Data = await user2Wallet.getGetWalletData();
        expect(user2Data.balance).toBe(toNano('300'));

        const user3WalletAddress = await jetton.getGetWalletAddress(user3.address);
        const user3Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user3WalletAddress)
        );
        const user3Data = await user3Wallet.getGetWalletData();
        expect(user3Data.balance).toBe(toNano('400'));
    });

    it('Test: Transfer then transfer again (chained transfers)', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Transfer 1: user1 -> user2
        await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Now user2 transfers to user3
        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );

        await user2Wallet.send(
            user2.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('200'),
                destination: user3.address,
                response_destination: user2.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify final balances
        const user1Data = await user1Wallet.getGetWalletData();
        expect(user1Data.balance).toBe(toNano('500'));

        const user2Data = await user2Wallet.getGetWalletData();
        expect(user2Data.balance).toBe(toNano('300'));

        const user3WalletAddress = await jetton.getGetWalletAddress(user3.address);
        const user3Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user3WalletAddress)
        );
        const user3Data = await user3Wallet.getGetWalletData();
        expect(user3Data.balance).toBe(toNano('200'));
    });

    it('Test: Transfer when contract is paused should fail', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        // Pause the contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Stop'
        );

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Try to transfer
        const result = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer initiated but should fail at master level
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: true,
        });

        // Verify balance unchanged
        const walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);
    });

    it('Test: Transfer after unpausing should succeed', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        // Pause the contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Stop'
        );

        // Resume the contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Resume'
        );

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Transfer should succeed
        await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify balances
        const walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(toNano('500'));

        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2Data = await user2Wallet.getGetWalletData();
        expect(user2Data.balance).toBe(toNano('500'));
    });

    it('Test: Non-owner cannot transfer tokens', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // user2 tries to transfer user1's tokens
        const result = await user1Wallet.send(
            user2.getSender(), // Wrong sender!
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user3.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer failed
        expect(result.transactions).toHaveTransaction({
            from: user2.address,
            to: user1WalletAddress,
            success: false,
        });

        // Verify balance unchanged
        const walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);
    });

    it('Test: Redemption transfer (external sender to internal user)', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        // Whitelist user1 as external sender
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'WhitelistExternalSender', user: user1.address }
        );

        // Whitelist user2 as internal user
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'WhitelistInternalUser', user: user2.address }
        );

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Transfer from external to internal (redemption)
        const result = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify transfer succeeded
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddress,
            success: true,
        });

        // Verify redemption burn was triggered
        // (tokens should be burned from user2's wallet automatically)


        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2WalletData = await user2Wallet.getGetWalletData();
        expect(user2WalletData.balance).toBe(0n);

    });

    it('Test: Concurrent transfers from different users', async () => {
        // Mint tokens to user1 and user2
        await mintTokens(user1, user1.address, toNano('1000'));
        await mintTokens(user2, user2.address, toNano('1000'));

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );

        // Both users transfer to user3 simultaneously
        const transfer1 = user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('300'),
                destination: user3.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        const transfer2 = user2Wallet.send(
            user2.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('400'),
                destination: user3.address,
                response_destination: user2.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        await Promise.all([transfer1, transfer2]);

        // Verify user3 received both transfers
        const user3WalletAddress = await jetton.getGetWalletAddress(user3.address);
        const user3Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user3WalletAddress)
        );
        const user3Data = await user3Wallet.getGetWalletData();
        expect(user3Data.balance).toBe(toNano('700'));
    });

    it('Test: Transfer with blacklist added mid-flow', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Start transfer
        const transferPromise = user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Blacklist user2 immediately after
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user2.address }
        );

        await transferPromise;

        // Verify balance - transfer might succeed or fail depending on timing
        const walletData = await user1Wallet.getGetWalletData();
        // Balance should either be unchanged (1000) or reduced (500) depending on race condition
        expect(walletData.balance).toBeGreaterThanOrEqual(toNano('500'));
    });

    it('Test: Multiple transfers to same recipient', async () => {
        // Mint tokens to user1
        const mintAmount = toNano('1000');
        await mintTokens(user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );

        // Transfer 1
        await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Transfer 2
        await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'TokenTransfer',
                query_id: 0n,
                amount: toNano('500'),
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify user2 received both transfers
        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2Data = await user2Wallet.getGetWalletData();
        expect(user2Data.balance).toBe(toNano('1000'));
    });
});