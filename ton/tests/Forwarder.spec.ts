import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Cell } from '@ton/core';
import { AdminOperations } from '../build/AdminOperations/AdminOperations_AdminOperations';
import { Forwarder } from '../build/Forwarder/Forwarder_Forwarder';
import '@ton/test-utils';



// ============================================================================

describe('Forwarder Tests', () => {
    let blockchain: Blockchain;
    let forwarder: SandboxContract<Forwarder>;
    let admin: SandboxContract<AdminOperations>;
    let deployer: SandboxContract<TreasuryContract>;
    let bridge: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        bridge = await blockchain.treasury('bridge');
        user1 = await blockchain.treasury('user1');

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
    });

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
            from: deployer.address,
            to: user1.address,
            value: toNano('0.1'),
            gas: 100000n,
            nonce: 0n,
            data: Cell.EMPTY
        } as any;

        // Execute once
        await forwarder.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'ExecuteForward',
                request,
                signature: Cell.EMPTY.beginParse()
            }
        );

        // Try to execute same request again (replay)
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
});