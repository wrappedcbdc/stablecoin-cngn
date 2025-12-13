import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, Cell, beginCell, fromNano } from '@ton/core';
import { AdminOperations } from '../build/AdminOperations/AdminOperations_AdminOperations';
import { Forwarder } from '../build/Forwarder/Forwarder_Forwarder';
import { CngnJetton } from '../build/CngnJetton/CngnJetton_CngnJetton';
import { CngnJettonWallet } from '../build/CngnJetton/CngnJetton_CngnJettonWallet';
import '@ton/test-utils';
import { buildOnchainMetadata } from '../utils/metadata';

describe('CngnJetton Integration Tests', () => {
    let blockchain: Blockchain;
    let jetton: SandboxContract<CngnJetton>;
    let admin: SandboxContract<AdminOperations>;
    let forwarder: SandboxContract<Forwarder>;
    let deployer: SandboxContract<TreasuryContract>;
    let minter: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let bridge: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        minter = await blockchain.treasury('minter');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');
        bridge = await blockchain.treasury('bridge');

        admin = blockchain.openContract(
            await AdminOperations.fromInit(deployer.address)
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        forwarder = blockchain.openContract(
            await Forwarder.fromInit(deployer.address, admin.address)
        );

        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        const jettonParams = {
            name: 'CNGN',
            description: 'Nigerian fiat-backed stablecoin on TON Blockchain',
            symbol: 'cNGN',
            image: 'https://i.ibb.co/GthZ88P/b18069c3b2ac.jpg',
        };

        jetton = blockchain.openContract(
            await CngnJetton.fromInit(
                deployer.address,
                admin.address,
                forwarder.address,
            )
        );

        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.5') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Mint initial tokens to user1 for testing
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'Mint',
                amount: toNano('10000'),
                receiver: user1.address
            }
        );
    });

    // ========================================================================
    // JETTON TRANSFER TESTS
    // ========================================================================

    it('Test 11: User should transfer jettons to another user', async () => {
        const transferAmount = toNano('1000');
        const user1JettonWallet = await getJettonWallet(user1.address);

        // Verify initial balance
        const senderBeforeData = await getJettonWalletBalance(user1.address);
        console.log('Sender Before Balance:', fromNano(senderBeforeData.toString()));
        expect(senderBeforeData).toBe(toNano('10000'));

        // Perform transfer
        const result = await user1JettonWallet.send(
            user1.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'Transfer',
                query_id: 0n,
                amount: transferAmount,
                destination: user2.address,
                response_destination: user1.address,
                forward_ton_amount: toNano('0.01'),
                forward_payload: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: user1JettonWallet.address,
        });

        // Verify sender balance decreased
        const senderAfterData = await getJettonWalletBalance(user1.address);
        console.log('Sender After Balance:', fromNano(senderAfterData.toString()));
        expect(senderAfterData).toBe(toNano('9000'));

        // Verify receiver got the tokens
        const receiverData = await getJettonWalletBalance(user2.address);
        console.log('Receiver Balance:', fromNano(receiverData.toString()));
        expect(receiverData).toBe(transferAmount);
    });

    it('Test 12: Should perform partial transfer', async () => {
        const partialAmount = toNano('2500');
        const wallet = await getJettonWallet(user1.address);

        const initialData = await wallet.getGetWalletData();
        expect(initialData.balance).toBe(toNano('10000'));

        const result = await wallet.send(
            user1.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'Transfer',
                query_id: 1n,
                amount: partialAmount,
                destination: user2.address,
                response_destination: user1.address,
                forward_ton_amount: toNano('0.01'),
                forward_payload: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: wallet.address,
        });

        // Verify receiver got the tokens
        const receiverData = await getJettonWalletBalance(user2.address);
        expect(receiverData).toBe(partialAmount);

        // Verify sender has remaining balance
        const senderData = await getJettonWalletBalance(user1.address);
        expect(senderData).toBe(toNano('7500'));
    });

    it('Test 13: Should perform large transfer (90% of balance)', async () => {
        const largeAmount = toNano('9000');
        const wallet = await getJettonWallet(user1.address);

        const initialData = await wallet.getGetWalletData();
        expect(initialData.balance).toBe(toNano('10000'));

        const result = await wallet.send(
            user1.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'Transfer',
                query_id: 2n,
                amount: largeAmount,
                destination: user2.address,
                response_destination: user1.address,
                forward_ton_amount: toNano('0.02'),
                forward_payload: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: wallet.address,
        });

        // Verify receiver got the tokens
        const receiverData = await getJettonWalletBalance(user2.address);
        expect(receiverData).toBe(largeAmount);

        // Verify sender has remaining balance
        const senderData = await getJettonWalletBalance(user1.address);
        expect(senderData).toBe(toNano('1000'));
    });

    it('Test 14: Should fail transfer with insufficient balance', async () => {
        const excessiveAmount = toNano('15000');
        const wallet = await getJettonWallet(user1.address);

        const result = await wallet.send(
            user1.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'Transfer',
                query_id: 3n,
                amount: excessiveAmount,
                destination: user2.address,
                response_destination: user1.address,
                forward_ton_amount: toNano('0.01'),
                forward_payload: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
            from: user1.address,
        });
    });

    it('Test 15: Should fail transfer from non-owner', async () => {
        const wallet = await getJettonWallet(user1.address);

        const result = await wallet.send(
            user2.getSender(), // Wrong sender
            { value: toNano('0.5') },
            {
                $$type: 'Transfer',
                query_id: 4n,
                amount: toNano('1000'),
                destination: user2.address,
                response_destination: user1.address,
                forward_ton_amount: toNano('0.01'),
                forward_payload: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
            from: user2.address,
        });
    });

    // ========================================================================
    // JETTON BURN TESTS
    // ========================================================================

    it('Test 16: User should burn their own tokens', async () => {
        const burnAmount = toNano('3000');
        const wallet = await getJettonWallet(user1.address);

        const initialData = await wallet.getGetWalletData();
        expect(initialData.balance).toBe(toNano('10000'));

        const initialJettonData = await jetton.getGetJettonData();
        const initialTotalSupply = initialJettonData.totalSupply;

        const result = await wallet.send(
            user1.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'Burn',
                query_id: 5n,
                amount: burnAmount,
                response_destination: user1.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: wallet.address,
            to: jetton.address,
        });

        // Verify wallet balance decreased
        const walletData = await wallet.getGetWalletData();
        expect(walletData.balance).toBe(toNano('7000'));

        // Verify total supply decreased
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(initialTotalSupply - burnAmount);
    });

    it('Test 17: Should burn entire balance', async () => {
        const wallet = await getJettonWallet(user1.address);

        const walletData = await wallet.getGetWalletData();
        const entireBalance = walletData.balance;

        const result = await wallet.send(
            user1.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'Burn',
                query_id: 6n,
                amount: entireBalance,
                response_destination: user1.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
        });

        const updatedWalletData = await wallet.getGetWalletData();
        expect(updatedWalletData.balance).toBe(0n);
    });

    it('Test 18: Should fail burn with insufficient balance', async () => {
        const wallet = await getJettonWallet(user1.address);

        const result = await wallet.send(
            user1.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'Burn',
                query_id: 7n,
                amount: toNano('20000'), // More than available
                response_destination: user1.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 19: Should fail burn from non-owner', async () => {
        const wallet = await getJettonWallet(user1.address);

        const result = await wallet.send(
            user2.getSender(), // Wrong sender
            { value: toNano('0.5') },
            {
                $$type: 'Burn',
                query_id: 8n,
                amount: toNano('1000'),
                response_destination: user1.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    // ========================================================================
    // ADMIN OPERATIONS TESTS
    // ========================================================================

    it('Test 20: Owner should pause contract', async () => {
        const result = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'pause'
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: jetton.address,
        });

        // Try to mint while paused (should fail)
        const mintResult = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'Mint',
                amount: toNano('1000'),
                receiver: user2.address
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 21: Owner should unpause contract', async () => {
        // First pause
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'pause'
        );

        // Then unpause
        const result = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'unpause'
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: jetton.address,
        });

        // Try to mint after unpause (should succeed)
        const mintResult = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'Mint',
                amount: toNano('1000'),
                receiver: user2.address
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('Test 22: Non-owner should fail to pause', async () => {
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.1') },
            'pause'
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 23: Should update admin operations contract', async () => {
        const newAdmin = await blockchain.treasury('newAdmin');

        const result = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'UpdateAdminOperations',
                newAdmin: newAdmin.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('Test 24: Should update forwarder contract', async () => {
        const newForwarder = await blockchain.treasury('newForwarder');

        const result = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'UpdateForwarder',
                newForwarder: newForwarder.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('Test 25: Admin operations should mint tokens', async () => {
        const initialSupply = (await jetton.getGetJettonData()).totalSupply;

        const result = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'Mint',
                amount: toNano('5000'),
                receiver: user2.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
        });

        const finalSupply = (await jetton.getGetJettonData()).totalSupply;
        expect(finalSupply).toBe(initialSupply + toNano('5000'));

        const user2Balance = await getJettonWalletBalance(user2.address);
        expect(user2Balance).toBe(toNano('5000'));
    });

    it('Test 26: Owner should force burn blacklisted funds', async () => {
        const initialSupply = (await jetton.getGetJettonData()).totalSupply;
        const user1InitialBalance = await getJettonWalletBalance(user1.address);

        const result = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'DestroyBlacklistedFunds',
                user: user1.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
        });

        // Verify user balance is zero
        const user1FinalBalance = await getJettonWalletBalance(user1.address);
        expect(user1FinalBalance).toBe(0n);

        // Verify total supply decreased
        const finalSupply = (await jetton.getGetJettonData()).totalSupply;
        expect(finalSupply).toBe(initialSupply - user1InitialBalance);
    });

    it('Test 27: Non-owner should fail to force burn', async () => {
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'DestroyBlacklistedFunds',
                user: user2.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    // ========================================================================
    // FORWARDER TESTS
    // ========================================================================

    it('Test 28: Should authorize bridge', async () => {
        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AuthorizeBridge',
                bridge: bridge.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: forwarder.address,
        });

        const isAuthorized = await forwarder.getIsBridgeAuthorized(bridge.address);
        expect(isAuthorized).toBe(true);
    });

    it('Test 29: Should deauthorize bridge', async () => {
        // First authorize
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AuthorizeBridge',
                bridge: bridge.address
            }
        );

        let isAuthorized = await forwarder.getIsBridgeAuthorized(bridge.address);
        expect(isAuthorized).toBe(true);

        // Then deauthorize
        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'DeauthorizeBridge',
                bridge: bridge.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: forwarder.address,
        });

        isAuthorized = await forwarder.getIsBridgeAuthorized(bridge.address);
        expect(isAuthorized).toBe(false);
    });

    it('Test 30: Non-owner should fail to authorize bridge', async () => {
        const result = await forwarder.send(
            user1.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AuthorizeBridge',
                bridge: bridge.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
            from: user1.address,
        });
    });

    it('Test 31: Owner should execute forward request', async () => {
        const nonce = await forwarder.getGetNonce(user1.address);

        const forwardData = beginCell()
            .storeUint(1, 32) // Some operation code
            .endCell();

        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
               $$type: 'ExecuteForward',
                request: {
                    $$type: 'ForwardRequest',
                    from: user1.address,
                    to: user2.address,
                    value: toNano('0.05'),
                    gas: 50000n,
                    nonce: nonce,
                    data: forwardData
                },
                signature: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: forwarder.address,
        });

        // Nonce should be incremented
        const newNonce = await forwarder.getGetNonce(user1.address);
        expect(newNonce).toBe(nonce + 1n);
    });

    it('Test 32: Authorized bridge should execute forward request', async () => {
        // Authorize bridge first
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AuthorizeBridge',
                bridge: bridge.address
            }
        );

        const nonce = await forwarder.getGetNonce(user1.address);

        const forwardData = beginCell()
            .storeUint(2, 32)
            .endCell();

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.2') },
            {
               $$type: 'ExecuteForward',
                request: {
                    $$type: 'ForwardRequest',
                    from: user1.address,
                    to: user2.address,
                    value: toNano('0.05'),
                    gas: 50000n,
                    nonce: nonce,
                    data: forwardData
                },
                signature: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: bridge.address,
            to: forwarder.address,
        });

        // Nonce should be incremented
        const newNonce = await forwarder.getGetNonce(user1.address);
        expect(newNonce).toBe(nonce + 1n);
    });

    it('Test 33: Should fail forward with invalid nonce', async () => {
        const nonce = await forwarder.getGetNonce(user1.address);

        const forwardData = beginCell()
            .storeUint(3, 32)
            .endCell();

        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
               $$type: 'ExecuteForward',
                request: {
                    $$type: 'ForwardRequest',
                    from: user1.address,
                    to: user2.address,
                    value: toNano('0.05'),
                    gas: 50000n,
                    nonce: nonce + 10n, // Invalid nonce
                    data: forwardData
                },
                signature: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 34: Should prevent replay attacks', async () => {
        const nonce = await forwarder.getGetNonce(user1.address);

        const forwardData = beginCell()
            .storeUint(4, 32)
            .endCell();

        const request = {
            $$type: 'ForwardRequest' as const,
            from: user1.address,
            to: user2.address,
            value: toNano('0.05'),
            gas: 50000n,
            nonce: nonce,
            data: forwardData
        };

        // First execution should succeed
        const firstResult = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
               $$type: 'ExecuteForward',
                request: request,
                signature: beginCell().endCell()
            }
        );

        expect(firstResult.transactions).toHaveTransaction({
            success: true,
        });

        // Second execution with same request should fail (replay attack)
        const secondResult = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'ExecuteForward',
                request: request,
                signature: beginCell().endCell()
            }
        );

        expect(secondResult.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 35: Should fail forward when paused', async () => {
        // Pause the forwarder
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            'pause'
        );

        const nonce = await forwarder.getGetNonce(user1.address);

        const forwardData = beginCell()
            .storeUint(5, 32)
            .endCell();

        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
               $$type: 'ExecuteForward',
                request: {
                    $$type: 'ForwardRequest',
                    from: user1.address,
                    to: user2.address,
                    value: toNano('0.05'),
                    gas: 50000n,
                    nonce: nonce,
                    data: forwardData
                },
                signature: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 36: Should execute forward after unpause', async () => {
        // Pause then unpause
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            'pause'
        );

        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            'unpause'
        );

        const nonce = await forwarder.getGetNonce(user1.address);

        const forwardData = beginCell()
            .storeUint(6, 32)
            .endCell();

        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
               $$type: 'ExecuteForward',
                request: {
                    $$type: 'ForwardRequest',
                    from: user1.address,
                    to: user2.address,
                    value: toNano('0.05'),
                    gas: 50000n,
                    nonce: nonce,
                    data: forwardData
                },
                signature: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('Test 37: Should fail forward from unauthorized sender', async () => {
        const nonce = await forwarder.getGetNonce(user1.address);

        const forwardData = beginCell()
            .storeUint(7, 32)
            .endCell();

        const result = await forwarder.send(
            user1.getSender(), // Unauthorized sender (not owner or authorized bridge)
            { value: toNano('0.2') },
            {
               $$type: 'ExecuteForward',
                request: {
                    $$type: 'ForwardRequest',
                    from: user1.address,
                    to: user2.address,
                    value: toNano('0.05'),
                    gas: 50000n,
                    nonce: nonce,
                    data: forwardData
                },
                signature: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
            from: user1.address,
        });
    });

    it('Test 38: Should update admin operations contract', async () => {
        const newAdmin = await blockchain.treasury('newAdmin');

        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'UpdateAdminOps',
                newAdmin: newAdmin.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: forwarder.address,
        });
    });

    it('Test 39: Non-owner should fail to update admin operations', async () => {
        const newAdmin = await blockchain.treasury('newAdmin');

        const result = await forwarder.send(
            user1.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'UpdateAdminOps',
                newAdmin: newAdmin.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 40: Should forward mint request through forwarder', async () => {
        // Authorize bridge
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AuthorizeBridge',
                bridge: bridge.address
            }
        );

        const nonce = await forwarder.getGetNonce(bridge.address);
        const mintAmount = toNano('5000');

        // Create mint message data
        const mintData = beginCell()
            .storeUint(0x01, 32) // Mint opcode (example)
            .storeCoins(mintAmount)
            .storeAddress(user2.address)
            .endCell();

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
               $$type: 'ExecuteForward',
                request: {
                    $$type: 'ForwardRequest',
                    from: bridge.address,
                    to: jetton.address,
                    value: toNano('0.3'),
                    gas: 100000n,
                    nonce: nonce,
                    data: mintData
                },
                signature: beginCell().endCell()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: true,
            from: bridge.address,
        });

        // Verify nonce incremented
        const newNonce = await forwarder.getGetNonce(bridge.address);
        expect(newNonce).toBe(nonce + 1n);
    });

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    async function getJettonWalletBalance(address: Address): Promise<bigint> {
        const jettonWallet = await getJettonWallet(address);
        const walletData = await jettonWallet.getGetWalletData();
        return walletData.balance;
    }

    async function getJettonWallet(address: Address): Promise<SandboxContract<CngnJettonWallet>> {
        const walletAddress = await jetton.getGetWalletAddress(address);
        const wallet = blockchain.openContract(await CngnJettonWallet.fromAddress(walletAddress));
        return wallet;
    }
});