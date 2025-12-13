import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Cell, beginCell, Address } from '@ton/core';
import { AdminOperations } from '../build/AdminOperations/AdminOperations_AdminOperations';
import { Forwarder, ForwardRequest } from '../build/Forwarder/Forwarder_Forwarder';
import { CngnJetton } from '../build/CngnJetton/CngnJetton_CngnJetton';
import { CngnJettonWallet } from '../build/CngnJetton/CngnJetton_CngnJettonWallet';
import '@ton/test-utils';
import { buildOnchainMetadata } from '../utils/metadata';
import { jettonMetadata } from '../utils/cngn';

describe('Forwarder Transaction Tests', () => {
    let blockchain: Blockchain;
    let forwarder: SandboxContract<Forwarder>;
    let admin: SandboxContract<AdminOperations>;
    let jetton: SandboxContract<CngnJetton>;
    let deployer: SandboxContract<TreasuryContract>;
    let bridge: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        bridge = await blockchain.treasury('bridge');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        let content = buildOnchainMetadata(jettonMetadata);

        // Deploy AdminOperations
        admin = blockchain.openContract(
            await AdminOperations.fromInit(deployer.address)
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Deploy Forwarder
        forwarder = blockchain.openContract(
            await Forwarder.fromInit(deployer.address, admin.address)
        );
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Authorize bridge
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AuthorizeBridge', bridge: bridge.address }
        );

        // Deploy Jetton Master
        jetton = blockchain.openContract(
            await CngnJetton.fromInit(deployer.address, admin.address, forwarder.address, content)
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
            {
                $$type: 'SetJettonMaster',
                jettonMaster: jetton.address
            }
        );
    });

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    function createForwardRequest(
        from: Address,
        to: Address,
        value: bigint,
        nonce: bigint,
        data: Cell
    ): ForwardRequest {
        return {
            $$type: 'ForwardRequest',
            from,
            to,
            value,
            gas: 100000n,
            nonce,
            data
        };
    }

    // Build TEP-74 Compliant TokenTransfer (0x0f8a7ea5)
    function buildTokenTransferMessage(
        queryId: bigint,
        amount: bigint,
        destination: Address,
        responseDestination: Address,
        forwardTonAmount: bigint = 0n,
        forwardPayload: Cell = beginCell().endCell(),
        customPayload: Cell = beginCell().endCell()
    ): Cell {
        return beginCell()
            .storeUint(0x0f8a7ea5, 32) // TEP-74 standard TokenTransfer opcode
            .storeUint(queryId, 64)
            .storeCoins(amount)
            .storeAddress(destination)
            .storeAddress(responseDestination)
            .storeRef(customPayload) // CRITICAL: custom_payload BEFORE forward_ton_amount
            .storeCoins(forwardTonAmount)
            .storeRef(forwardPayload)
            .endCell();
    }

    // Build TEP-74 Compliant Burn (0x595f07bc)
    function buildBurnMessage(
        queryId: bigint,
        amount: bigint,
        responseDestination: Address,
        customPayload: Cell = beginCell().endCell()
    ): Cell {
        return beginCell()
            .storeUint(0x595f07bc, 32) // TEP-74 standard Burn opcode
            .storeUint(queryId, 64)
            .storeCoins(amount)
            .storeAddress(responseDestination)
            .storeRef(customPayload) // Added for TEP-74 compliance
            .endCell();
    }

    // Build RequestMint with correct opcode (0x14bd81cb)
    function buildRequestMintMessage(
        amount: bigint,
        receiver: Address
    ): Cell {
        return beginCell()
            .storeUint(0x14bd81cb, 32) // RequestMint opcode
            .storeCoins(amount)
            .storeAddress(receiver)
            .endCell();
    }

    // Build AddCanMint with correct opcode (0x244afe73)
    function buildAddCanMintMessage(user: Address): Cell {
        return beginCell()
            .storeUint(0x244afe73, 32)
            .storeAddress(user)
            .endCell();
    }

    // Build AddMintAmount with correct opcode (0xcea3e0e1)
    function buildAddMintAmountMessage(user: Address, amount: bigint): Cell {
        return beginCell()
            .storeUint(0xcea3e0e1, 32)
            .storeAddress(user)
            .storeCoins(amount)
            .endCell();
    }

    async function mintTokensDirectly(
        admin: SandboxContract<AdminOperations>,
        jetton: SandboxContract<CngnJetton>,
        minter: SandboxContract<TreasuryContract>,
        receiver: Address,
        amount: bigint
    ) {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: minter.address }
        );
        let canMint = await admin.getGetCanMint(minter.address);
        expect(canMint).toBe(true);
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: minter.address, amount }
        );
        const result = await jetton.send(
            minter.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount, receiver }
        );


        // Verify the transaction chain
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });

        // Verify jetton master queries admin
        expect(result.transactions).toHaveTransaction({
            from: jetton.address,
            to: admin.address,
            success: true,
        });

        // Verify admin responds to jetton
        expect(result.transactions).toHaveTransaction({
            from: admin.address,
            to: jetton.address,
            success: true,
        });

        // Verify mint was executed
        const userWalletAddress = await jetton.getGetWalletAddress(receiver);
        const wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(userWalletAddress)
        );
        const walletData = await wallet.getGetWalletData();
        expect(walletData.balance).toBe(amount);

        // Verify total supply increased
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(amount);

        // Step 4: Verify canMint was removed after successful mint
        canMint = await admin.getGetCanMint(user1.address);
        expect(canMint).toBe(false);
    }

    // ========================================================================
    // BASIC FORWARDER TESTS
    // ========================================================================

    it('Test 1: Should deploy Forwarder contract', async () => {
        expect(await forwarder.getOwner()).toEqualAddress(deployer.address);
    });

    it('Test 2: Should pause contract', async () => {
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            'pause'
        );
    });

    it('Test 3: Should unpause contract', async () => {
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
    });

    it('Test 4: Should update admin operations address', async () => {
        const newAdmin = await blockchain.treasury('newAdmin');

        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'UpdateAdminOps', newAdmin: newAdmin.address }
        );
    });

    it('Test 5: Should authorize bridge', async () => {
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AuthorizeBridge', bridge: bridge.address }
        );

        expect(await forwarder.getIsBridgeAuthorized(bridge.address)).toBe(true);
    });

    it('Test 6: Should deauthorize bridge', async () => {
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AuthorizeBridge', bridge: bridge.address }
        );

        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'DeauthorizeBridge', bridge: bridge.address }
        );

        expect(await forwarder.getIsBridgeAuthorized(bridge.address)).toBe(false);
    });

    it('Test 7: Should get nonce for user', async () => {
        const nonce = await forwarder.getGetNonce(user1.address);
        expect(nonce).toBe(0n);
    });

    it('Test 8: Should prevent unauthorized execution', async () => {
        const request = {
            from: user1.address,
            to: deployer.address,
            value: toNano('0.1'),
            gas: 100000n,
            nonce: 0n,
            data: Cell.EMPTY
        } as any;

        const result = await forwarder.send(
            user1.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 9: Should reject execution when paused', async () => {
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            'pause'
        );

        const request = {
            from: deployer.address,
            to: user1.address,
            value: toNano('0.1'),
            gas: 100000n,
            nonce: 0n,
            data: Cell.EMPTY
        } as any;

        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 10: Should prevent replay attacks', async () => {

        const request = {
            $$type: 'ForwardRequest',
            from: deployer.address,
            to: user1.address,
            value: toNano('0.1'),
            gas: 100000n,
            nonce: 0n,
            data: Cell.EMPTY
        } as any;

        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        const result = await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    // ========================================================================
    // FORWARDING TESTS
    // ========================================================================

    it('Test 11: Should forward simple TON transfer', async () => {
        const request = {
            $$type: "ForwardRequest",
            from: user1.address,
            to: user2.address,
            value: toNano('0.5'),
            gas: 0n,
            nonce: 0n,
            data: Cell.EMPTY
        } as any;

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('1') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: forwarder.address,
            success: true,
        });

        expect(result.transactions).toHaveTransaction({
            from: forwarder.address,
            to: user2.address,
            success: true,
        });

        expect(await forwarder.getGetNonce(user1.address)).toBe(1n);
    });

    it('Test 12: Should forward multiple transactions with correct nonce sequence', async () => {
        let request = createForwardRequest(
            user1.address,
            user2.address,
            toNano('0.1'),
            0n,
            Cell.EMPTY
        ) as any;

        await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(await forwarder.getGetNonce(user1.address)).toBe(1n);

        request = createForwardRequest(
            user1.address,
            user2.address,
            toNano('0.1'),
            1n,
            Cell.EMPTY
        );

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: forwarder.address,
            to: user2.address,
            success: true,
        });

        expect(await forwarder.getGetNonce(user1.address)).toBe(2n);
    });

    it('Test 13: Should reject forwarded transaction with incorrect nonce', async () => {
        const request = createForwardRequest(
            user1.address,
            user2.address,
            toNano('0.1'),
            5n,
            Cell.EMPTY
        );

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: forwarder.address,
            success: false,
        });

        expect(await forwarder.getGetNonce(user1.address)).toBe(0n);
    });

    it('Test 14: Should track nonces independently for different users', async () => {
        let request = createForwardRequest(
            user1.address,
            user2.address,
            toNano('0.1'),
            0n,
            Cell.EMPTY
        );

        await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        request = createForwardRequest(
            user2.address,
            user1.address,
            toNano('0.1'),
            0n,
            Cell.EMPTY
        );

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: forwarder.address,
            success: true,
        });

        expect(await forwarder.getGetNonce(user1.address)).toBe(1n);
        expect(await forwarder.getGetNonce(user2.address)).toBe(1n);
    });

    // ========================================================================
    // JETTON OPERATIONS WITH CORRECT OPCODES
    // ========================================================================

    it('Test 15: Should forward jetton transfer with TEP-74 compliant opcode', async () => {
        const mintAmount = toNano('1000');
        await mintTokensDirectly(admin, jetton, user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1WalletBefore = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );
        const user1DataBefore = await user1WalletBefore.getGetWalletData();
        console.log(user1DataBefore.balance);

        const transferAmount = toNano('500');
        const transferMessage = buildTokenTransferMessage(
            0n,
            transferAmount,
            user2.address,
            user1.address,
            0n
        );

        const request = createForwardRequest(
            user1.address,
            user1WalletAddress,
            toNano('0.2'),
            0n,
            transferMessage
        );

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: forwarder.address,
            success: true,
        });
console.log(result.transactions);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );
        const user1Data = await user1Wallet.getGetWalletData();
        expect(user1Data.balance).toBe(mintAmount - transferAmount);

        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2Data = await user2Wallet.getGetWalletData();
        expect(user2Data.balance).toBe(transferAmount);

        expect(await forwarder.getGetNonce(user1.address)).toBe(1n);
    });

    it('Test 16: Should forward jetton burn with TEP-74 compliant opcode', async () => {
        const mintAmount = toNano('1000');
        await mintTokensDirectly(admin, jetton, user1, user1.address, mintAmount);

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);

        const burnAmount = toNano('300');
        const burnMessage = buildBurnMessage(
            0n,
            burnAmount,
            user1.address
        );

        const request = createForwardRequest(
            user1.address,
            user1WalletAddress,
            toNano('0.2'),
            0n,
            burnMessage
        );

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: forwarder.address,
            success: true,
        });

        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );
        const user1Data = await user1Wallet.getGetWalletData();
        expect(user1Data.balance).toBe(mintAmount - burnAmount);

        expect(await forwarder.getGetNonce(user1.address)).toBe(1n);
    });

    it('Test 17: Complete flow - admin setup and mint through Forwarder', async () => {
        const mintAmount = toNano('1000');

        // Step 1: Add mint permission via forwarder
        const addMintMsg = buildAddCanMintMessage(user1.address);
        let request = createForwardRequest(
            deployer.address,
            admin.address,
            toNano('0.05'),
            0n,
            addMintMsg
        );

        await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        // Step 2: Add mint amount via forwarder
        const addAmountMsg = buildAddMintAmountMessage(user1.address, mintAmount);
        request = createForwardRequest(
            deployer.address,
            admin.address,
            toNano('0.05'),
            1n,
            addAmountMsg
        );

        await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        // Step 3: Request mint via forwarder
        const mintMsg = buildRequestMintMessage(mintAmount, user1.address);
        request = createForwardRequest(
            user1.address,
            jetton.address,
            toNano('0.3'),
            0n,
            mintMsg
        );

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: forwarder.address,
            success: true,
        });

        // Verify mint succeeded
        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );
        const walletData = await user1Wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);

        // Verify nonces
        expect(await forwarder.getGetNonce(deployer.address)).toBe(2n);
        expect(await forwarder.getGetNonce(user1.address)).toBe(1n);
    });

    it('Test 18: Complete workflow - mint, transfer, and burn via Forwarder', async () => {
        const mintAmount = toNano('1000');
        const transferAmount = toNano('300');
        const burnAmount = toNano('200');

        // Setup and mint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: mintAmount }
        );
        await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: mintAmount, receiver: user1.address }
        );

        const user1WalletAddress = await jetton.getGetWalletAddress(user1.address);

        // Transfer via forwarder
        const transferMsg = buildTokenTransferMessage(
            0n,
            transferAmount,
            user2.address,
            user1.address,
            0n
        );

        let request = createForwardRequest(
            user1.address,
            user1WalletAddress,
            toNano('0.2'),
            0n,
            transferMsg
        );

        await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        // Burn via forwarder
        const burnMsg = buildBurnMessage(0n, burnAmount, user1.address);
        request = createForwardRequest(
            user1.address,
            user1WalletAddress,
            toNano('0.2'),
            1n,
            burnMsg
        );

        const result = await forwarder.send(
            bridge.getSender(),
            { value: toNano('0.5') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        // Verify final state
        const user1Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user1WalletAddress)
        );
        const user1Data = await user1Wallet.getGetWalletData();
        expect(user1Data.balance).toBe(toNano('500')); // 1000 - 300 - 200

        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const user2Data = await user2Wallet.getGetWalletData();
        expect(user2Data.balance).toBe(transferAmount);

        expect(await forwarder.getGetNonce(user1.address)).toBe(2n);
    });
});