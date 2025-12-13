import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { AdminOperations } from '../build/AdminOperations/AdminOperations_AdminOperations';

import '@ton/test-utils';

describe('AdminOperations Tests', () => {
    let blockchain: Blockchain;
    let admin: SandboxContract<AdminOperations>;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        admin = blockchain.openContract(
            await AdminOperations.fromInit(deployer.address)
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
    });

    it('Test 1: Should deploy AdminOperations contract', async () => {
        expect(await admin.getOwner()).toEqualAddress(deployer.address);
        expect(await admin.getGetCanMint(deployer.address)).toBe(true);
        expect(await admin.getGetCanForward(deployer.address)).toBe(true);
    });

    it('Test 2: Should add and remove minter', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        
        expect(await admin.getGetCanMint(user1.address)).toBe(true);

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'RemoveCanMint', user: user1.address }
        );
        
        expect(await admin.getGetCanMint(user1.address)).toBe(false);
    });

    it('Test 3: Should set and get mint amount', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );

        const amount = toNano('1000');
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddMintAmount', user: user1.address, amount }
        );

        expect(await admin.getGetMintAmount(user1.address)).toBe(amount);
    });

    it('Test 4: Should whitelist and blacklist external sender', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'WhitelistExternalSender', user: user1.address }
        );
        
        expect(await admin.getGetIsExternalWhitelisted(user1.address)).toBe(true);

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'BlacklistExternalSender', user: user1.address }
        );
        
        expect(await admin.getGetIsExternalWhitelisted(user1.address)).toBe(false);
    });

    it('Test 5: Should whitelist and blacklist internal user', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'WhitelistInternalUser', user: user1.address }
        );
        
        expect(await admin.getGetIsInternalWhitelisted(user1.address)).toBe(true);

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'BlacklistInternalUser', user: user1.address }
        );
        
        expect(await admin.getGetIsInternalWhitelisted(user1.address)).toBe(false);
    });

    it('Test 6: Should add user to blacklist', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user1.address }
        );
        
        expect(await admin.getGetIsBlacklisted(user1.address)).toBe(true);
    });

    it('Test 7: Should remove user from blacklist', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user1.address }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'RemoveBlacklist', user: user1.address }
        );
        
        expect(await admin.getGetIsBlacklisted(user1.address)).toBe(false);
    });

    it('Test 8: Should prevent blacklisted user from being minter', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddBlacklist', user: user1.address }
        );

        const result = await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanMint', user: user1.address }
        );
        
        expect(result.transactions).toHaveTransaction({
            success: false,
        });
    });

    it('Test 9: Should add and remove trusted contract', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddTrustedContract', contractAddr: user2.address }
        );

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'RemoveTrustedContract', contractAddr: user2.address }
        );
    });

    it('Test 10: Should add and remove forwarder', async () => {
        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'AddCanForward', user: user1.address }
        );
        
        expect(await admin.getGetCanForward(user1.address)).toBe(true);

        await admin.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'RemoveCanForward', user: user1.address }
        );
        
        expect(await admin.getGetCanForward(user1.address)).toBe(false);
    });
});