import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, Cell } from '@ton/core';
import { AdminOperations } from '../../build/AdminOperations/AdminOperations_AdminOperations';
import { Forwarder } from '../../build/Forwarder/Forwarder_Forwarder';
import { CngnJetton } from '../../build/CngnJetton/CngnJetton_CngnJetton';
import { CngnJettonWallet } from '../../build/CngnJetton/CngnJetton_CngnJettonWallet';
import '@ton/test-utils';
import { buildOnchainMetadata } from '../../utils/metadata';
import { jettonMetadata } from '../../utils/cngn';


describe('CngnJetton Config & Setup Tests', () => {
    let blockchain: Blockchain;
    let jetton: SandboxContract<CngnJetton>;
    let admin: SandboxContract<AdminOperations>;
    let forwarder: SandboxContract<Forwarder>;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');


        // Create content Cell
        let content = buildOnchainMetadata(jettonMetadata);
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

        jetton = blockchain.openContract(
            await CngnJetton.fromInit(
                deployer.address,
                admin.address,
                forwarder.address,
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

    it('Test: Should deploy Jetton contract', async () => {
        const data = await jetton.getGetJettonData();
        expect(data.totalSupply).toBe(0n);
        expect(data.mintable).toBe(true);
        expect(data.owner).toEqualAddress(deployer.address);
    });

    it('Test: Should pause and unpause', async () => {
        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            'Stop'
        );

        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            'Resume'
        );
    });

    it('Test: Should get wallet address', async () => {
        const walletAddress = await jetton.getGetWalletAddress(user1.address);
        expect(walletAddress).toBeDefined();
    });

    it('Test: Should update admin operations', async () => {
        const newAdmin = await blockchain.treasury('newAdmin');

        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'UpdateAdminOperations',
                newAdmin: newAdmin.address
            }
        );
    });

    it('Test: Should update forwarder', async () => {
        const newForwarder = await blockchain.treasury('newForwarder');

        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'UpdateForwarder',
                newForwarder: newForwarder.address
            }
        );
    });

    it('Test: Should destroy blacklisted funds', async () => {
        const mintAmount = toNano('1000');

        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.2') },
            {
                $$type: 'Mint',
                amount: mintAmount,
                receiver: user1.address
            }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user1.address }
        );

        await jetton.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'DestroyBlacklistedFunds',
                user: user1.address
            }
        );
    });

    it('Test: Should only allow owner to perform admin functions', async () => {
        const result = await jetton.send(
            user1.getSender(),
            { value: toNano('0.05') },
            'Stop'
        );

        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });
    it('Test: Verify jetton metadata was added correctly', async () => {
        await verifyJettonMetadata(jetton);
    });

    async function verifyJettonMetadata(jetton: SandboxContract<CngnJetton>) {
        const jettonData = await jetton.getGetJettonData();
        const metadataCell = jettonData.content;
        const expectedContent = buildOnchainMetadata(jettonMetadata);
        expect(metadataCell.equals(expectedContent)).toBe(true);
    }

});