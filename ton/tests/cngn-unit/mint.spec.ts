import { Blockchain, internal, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, beginCell, fromNano } from '@ton/core';
import { AdminOperations } from '../../build/AdminOperations/AdminOperations_AdminOperations';
import { CngnJetton } from '../../build/CngnJetton/CngnJetton_CngnJetton';
import { CngnJettonWallet } from '../../build/CngnJetton/CngnJetton_CngnJettonWallet';
import '@ton/test-utils';
import { jettonMetadata } from '../../utils/cngn';
import { buildOnchainMetadata } from '../../utils/metadata';



describe('CngnJetton Mint Tests', () => {
    let blockchain: Blockchain;
    let jetton: SandboxContract<CngnJetton>;
    let admin: SandboxContract<AdminOperations>;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let user3: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');
        user3 = await blockchain.treasury('user3');
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
            {
                $$type: 'SetJettonMaster',
                jettonMaster: jetton.address
            }
        );
    });

    it('Test: Complete mint flow - user with permission should mint successfully', async () => {
        // Step 1: Admin adds user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddCanMint',
                user: user1.address
            }
        );

        // Step 2: Admin sets mint amount for user1
        const mintAmount = toNano('5000');
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddMintAmount',
                user: user1.address,
                amount: mintAmount
            }
        );

        // Verify user1 has mint permission
        let canMint = await admin.getGetCanMint(user1.address);
        expect(canMint).toBe(true);

        let allowedAmount = await admin.getGetMintAmount(user1.address);
        expect(allowedAmount).toBe(mintAmount);

        // Step 3: User1 requests mint
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'RequestMint',
                amount: mintAmount,
                receiver: user2.address
            }
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
        const user2WalletAddress = await jetton.getGetWalletAddress(user2.address);
        const wallet = blockchain.openContract(
            await CngnJettonWallet.fromAddress(user2WalletAddress)
        );
        const walletData = await wallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);

        // Verify total supply increased
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(mintAmount);

        // Step 4: Verify canMint was removed after successful mint
        canMint = await admin.getGetCanMint(user1.address);
        expect(canMint).toBe(false);
    });
    it('Test: User without permission should fail to mint', async () => {
        // User1 tries to mint without permission
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'RequestMint',
                amount: toNano('1000'),
                receiver: user2.address
            }
        );

        // Request is sent but approval will be rejected
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });

        // Check that no tokens were minted
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: User trying to mint more than allowed amount should fail', async () => {
        // Add user1 with limited mint amount
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddCanMint',
                user: user1.address
            }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddMintAmount',
                user: user1.address,
                amount: toNano('1000') // Only 1000 allowed
            }
        );

        // Try to mint 5000 (more than allowed)
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'RequestMint',
                amount: toNano('5000'),
                receiver: user2.address
            }
        );

        // Verify mint was rejected
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);

        // Verify canMint is still true (not removed because mint failed)
        const canMint = await admin.getGetCanMint(user1.address);
        expect(canMint).toBe(true);
    });
    it('Test: Blacklisted user should not be able to mint', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddCanMint',
                user: user1.address
            }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddMintAmount',
                user: user1.address,
                amount: toNano('5000')
            }
        );

        // Blacklist user1
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddBlacklist',
                user: user1.address
            }
        );

        // Try to mint
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'RequestMint',
                amount: toNano('5000'),
                receiver: user2.address
            }
        );

        // Request is sent but approval will be rejected
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });

        // Verify mint was rejected
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Owner cannot mint directly without verification', async () => {
        // Owner mints directly (bypasses verification)
        const mintAmount = toNano('10000');
        const result = await jetton.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'Mint',
                amount: mintAmount,
                receiver: user2.address
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: jetton.address,
            success: true,
        });

        // Verify mint succeeded
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Multiple mint requests should work independently', async () => {
        // Setup user1 with permission
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddCanMint',
                user: user1.address
            }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddMintAmount',
                user: user1.address,
                amount: toNano('5000')
            }
        );

        // User1 mints
        await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'RequestMint',
                amount: toNano('5000'),
                receiver: user1.address
            }
        );

        // Add user2 permission
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddCanMint',
                user: user2.address
            }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddMintAmount',
                user: user2.address,
                amount: toNano('3000')
            }
        );

        // User2 mints
        await jetton.send(
            user2.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'RequestMint',
                amount: toNano('3000'),
                receiver: user2.address
            }
        );

        // Verify both mints succeeded
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(toNano('8000'));

        // Verify both users lost permission
        const canMint1 = await admin.getGetCanMint(user1.address);
        const canMint2 = await admin.getGetCanMint(user2.address);
        expect(canMint1).toBe(false);
        expect(canMint2).toBe(false);
    });
    it('Test: Contract paused should prevent RequestMint', async () => {
        // Setup user1 with permission
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddCanMint',
                user: user1.address
            }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddMintAmount',
                user: user1.address,
                amount: toNano('5000')
            }
        );

        // Pause jetton contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Stop'
        );

        // Try to request mint
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            {
                $$type: 'RequestMint',
                amount: toNano('5000'),
                receiver: user2.address
            }
        );

        // Verify mint failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: false,
        });

        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Zero amount mint request should fail', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        // Try to mint zero amount
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: 0n, receiver: user2.address }
        );
        // Verify mint failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: false,
        });
        // Verify total supply unchanged
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Concurrent mint requests from the same user should be handled', async () => {
        // Add user1 to canMint with sufficient allowance
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('10000') }
        );
        // Send two mint requests in parallel
        const result1 = jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        const result2 = jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        const [res1, res2] = await Promise.all([result1, result2]);
        // Verify only one mint succeeds (or both, depending on logic)
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBeLessThanOrEqual(toNano('10000'));
    });
    it('Test: Mint to zero address should fail', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        // Try to mint to zero address
        const zeroAddress = new Address(0, Buffer.alloc(32, 0));
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('1000'), receiver: zeroAddress }
        );
        // Verify mint failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: false,
        });
        // Verify total supply unchanged
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Admin rejects mint due to insufficient allowance', async () => {
        // Add user1 to canMint with limited allowance
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('1000') }
        );
        // Try to mint more than allowed
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('2000'), receiver: user2.address }
        );
        // Verify mint failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });
        // Verify total supply unchanged
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Mint after contract is paused and then unpaused', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('5000') }
        );
        // Pause the contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Stop'
        );
        // Try to mint while paused
        let result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        // Verify mint failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: false,
        });
        // Unpause the contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Resume'
        );
        // Try to mint again
        result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        // Verify mint succeeded
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(toNano('5000'));
    });
    it('Test: Mint to blacklisted reciever should fail', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('5000') }
        );
        // Blacklist user2
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user2.address }
        );
        // Try to mint to blacklisted user2
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        // Verify mint failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,

        });
        // Verify total supply unchanged
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Mint with admin contract upgrade', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('5000') }
        );
        // Deploy a new admin contract
        const newAdmin = blockchain.openContract(
            await AdminOperations.fromInit(deployer.address)
        );
        await newAdmin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
        // Upgrade admin contract in jetton
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            { $$type: 'UpdateAdminOperations', newAdmin: newAdmin.address }
        );
        // Try to mint with new admin
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        // Verify mint succeeded
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(toNano('5000'));
    });
    it('Test: Mint with malformed messages should fail', async () => {
        try {
            // Try to send a malformed RequestMint message
            const result = await jetton.send(

                user1.getSender(),

                { value: toNano('0.3') },
                /// @ts-ignore
                { $$type: 'MalformedRequestMint' } // Assume this is not a valid message type
            );
            // Verify mint failed
            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: jetton.address,
                success: false,
            });
        } catch (error: any) {
            expect(error.message).toEqual('Invalid message type');
            console.log('Caught expected error for malformed message:', error.message);
        }


        // Verify total supply unchanged
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Mint with large amounts should not overflow', async () => {
        // Try to mint a very large amount
        const largeAmount = 2n ** 120n - 1n;
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: largeAmount }
        );

        await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: largeAmount, receiver: user2.address }
        );
        // Verify mint failed or succeeded without overflow
        const jettonData = await jetton.getGetJettonData();
        console.log('Total Supply after large mint attempt:',fromNano( jettonData.totalSupply));
         expect(jettonData.totalSupply).toBe(largeAmount);
        // expect(jettonData.totalSupply).toBe(0n);

    });
    it('Test: Mint with multiple admins', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('1000') }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user2.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user2.address, amount: toNano('1000') }
        );

        // Try to mint with admin2 responding
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('200'), receiver: user2.address }
        );
        // Verify mint succeeded
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });

        const result2 = await jetton.send(
            user2.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('2.60'), receiver: user3.address }
        );

        // Verify mint succeeded
        expect(result2.transactions).toHaveTransaction({
            from: user2.address,
            to: jetton.address,
            success: true,
        });
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(toNano('202.60'));
    });
    it('Test: Mint with token decimals should work', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('5000') }
        );
        // Mint a fractional amount (assuming 9 decimals)
        const fractionalAmount = toNano('1.5');
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: fractionalAmount, receiver: user2.address }
        );
        // Verify mint succeeded
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(fractionalAmount);
    });
    it('Test: Mint with token paused mid-flow should fail', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('5000') }
        );
        // Send a mint request
        const mintPromise = jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        // Pause the contract before admin responds
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Stop'
        );
        const result = await mintPromise;
        // Verify mint failed
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,

        });
        // Verify total supply unchanged
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });
    it('Test: Mint with token unpaused mid-flow should succeed', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('5000') }
        );
        // Pause the contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Stop'
        );
        // Send a mint request (will fail)
        let result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: false,
        });
        // Unpause the contract
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            'Resume'
        );
        // Send a mint request again
        result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        // Verify mint succeeded
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(toNano('5000'));
    });
    it('Test: Mint with token ownership transfer should work', async () => {
        // Add user1 to canMint
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount: toNano('5000') }
        );
        // Transfer ownership to user2
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                queryId: 0n,
                $$type: 'ChangeOwner',
                newOwner: user2.address
            }
        );
        // Try to mint as user1
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.3') },
            { $$type: 'RequestMint', amount: toNano('5000'), receiver: user2.address }
        );
        // Verify mint succeeded
        expect(result.transactions).toHaveTransaction({
            from: user1.address,
            to: jetton.address,
            success: true,
        });
        const jettonData = await jetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(toNano('5000'));
    });
});