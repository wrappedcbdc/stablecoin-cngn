#[starknet::contract]
pub mod Cngn {
    use cngn::interface::IOperations::{IAdminDispatcher, IAdminDispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_token::erc20::ERC20Component;
    use starknet::storage::*;
    use starknet::{ContractAddress, get_caller_address};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl ERC20MetadataImpl = ERC20Component::ERC20MetadataImpl<ContractState>;

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    impl ERC20ImmutableConfig of ERC20Component::ImmutableConfig {
        const DECIMALS: u8 = 6;
    }

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        trusted_forwarder_contract: ContractAddress,
        admin_operations_contract: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        DestroyedBlackFunds: DestroyedBlackFunds,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DestroyedBlackFunds {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        trusted_forwarder_contract: ContractAddress,
        admin_operations_contract: ContractAddress,
        owner: ContractAddress,
    ) {
        self.erc20.initializer("cNGN", "cNGN");

        self.ownable.initializer(owner);

        self.trusted_forwarder_contract.write(trusted_forwarder_contract);
        self.admin_operations_contract.write(admin_operations_contract);
    }

    #[abi(embed_v0)]
    impl CngnImpl of super::ICngn<ContractState> {
        fn total_supply(self: @ContractState) -> u256 {
            self.erc20.total_supply()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.erc20.balance_of(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.erc20.allowance(owner, spender)
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            self.erc20.approve(spender, amount)
        }

        fn increase_allowance(
            ref self: ContractState, spender: ContractAddress, added_value: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.erc20.allowance(caller, spender);
            self.erc20.approve(spender, current_allowance + added_value)
        }

        fn decrease_allowance(
            ref self: ContractState, spender: ContractAddress, subtracted_value: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.erc20.allowance(caller, spender);
            assert(current_allowance >= subtracted_value, 'Allowance below zero');
            self.erc20.approve(spender, current_allowance - subtracted_value)
        }

        fn is_trusted_forwarder(self: @ContractState, forwarder: ContractAddress) -> bool {
            forwarder == self.trusted_forwarder_contract.read()
        }

        fn trusted_forwarder_contract(self: @ContractState) -> ContractAddress {
            self.trusted_forwarder_contract.read()
        }

        fn admin_operations_contract(self: @ContractState) -> ContractAddress {
            self.admin_operations_contract.read()
        }

        fn update_admin_operations_address(
            ref self: ContractState, new_admin: ContractAddress,
        ) -> bool {
            self.ownable.assert_only_owner();
            self.admin_operations_contract.write(new_admin);
            true
        }

        fn update_forwarder_contract(
            ref self: ContractState, new_forwarder_contract: ContractAddress,
        ) -> bool {
            self.ownable.assert_only_owner();
            self.trusted_forwarder_contract.write(new_forwarder_contract);
            true
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            self.pausable.assert_not_paused();

            let caller = get_caller_address();
            let admin_contract = IAdminDispatcher {
                contract_address: self.admin_operations_contract.read(),
            };

            assert(!admin_contract.is_black_listed(caller), 'Sender is blacklisted');
            assert(!admin_contract.is_black_listed(recipient), 'Recipient is blacklisted');

            if admin_contract.is_internal_user_whitelisted(recipient)
                && admin_contract.is_external_sender_whitelisted(caller) {
                self.erc20.transfer(recipient, amount);
                self.erc20.burn(recipient, amount);
            } else {
                self.erc20.transfer(recipient, amount);
            }

            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            self.pausable.assert_not_paused();

            let spender = get_caller_address();
            let admin_contract = IAdminDispatcher {
                contract_address: self.admin_operations_contract.read(),
            };

            assert(!admin_contract.is_black_listed(spender), 'Spender is blacklisted');
            assert(!admin_contract.is_black_listed(sender), 'Sender is blacklisted');
            assert(!admin_contract.is_black_listed(recipient), 'Recipient is blacklisted');

            let result = self.erc20.transfer_from(sender, recipient, amount);

            result
        }

        fn mint(ref self: ContractState, amount: u256, mint_to: ContractAddress) -> bool {
            let caller = get_caller_address();
            let owner = self.ownable.owner();

            assert(
                caller == owner || caller == self.trusted_forwarder_contract.read(),
                'Not deployer or forwarder',
            );

            let admin_contract = IAdminDispatcher {
                contract_address: self.admin_operations_contract.read(),
            };

            assert(!admin_contract.is_black_listed(caller), 'User is blacklisted');
            assert(!admin_contract.is_black_listed(mint_to), 'Receiver is blacklisted');

            assert(admin_contract.can_mint(caller), 'Minter not authorized');
            assert(admin_contract.mint_amount(caller) == amount, 'Amount exceeds allowed');

            let removed = admin_contract.remove_can_mint(caller);
            assert(removed, 'Failed to revoke auth');

            self.erc20.mint(mint_to, amount);

            true
        }

        fn burn_by_user(ref self: ContractState, amount: u256) -> bool {
            let caller = get_caller_address();
            let owner = self.ownable.owner();

            assert(
                caller == owner || caller == self.trusted_forwarder_contract.read(),
                'Not deployer or forwarder',
            );

            self.erc20.burn(caller, amount);
            true
        }

        fn pause(ref self: ContractState) -> bool {
            self.ownable.assert_only_owner();
            self.pausable.pause();
            true
        }

        fn unpause(ref self: ContractState) -> bool {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
            true
        }

        fn destroy_black_funds(ref self: ContractState, blacklisted_user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            let admin_contract = IAdminDispatcher {
                contract_address: self.admin_operations_contract.read(),
            };

            assert(admin_contract.is_black_listed(blacklisted_user), 'Address not blacklisted');

            let dirty_funds = self.erc20.balance_of(blacklisted_user);
            self.erc20.burn(blacklisted_user, dirty_funds);

            self.emit(DestroyedBlackFunds { user: blacklisted_user, amount: dirty_funds });

            true
        }
    }

    impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            let contract_state = self.get_contract();
            contract_state.pausable.assert_not_paused();
        }

        fn after_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {}
    }
}
use starknet::ContractAddress;

#[starknet::interface]
pub trait ICngn<TContractState> {
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn increase_allowance(
        ref self: TContractState, spender: ContractAddress, added_value: u256,
    ) -> bool;
    fn decrease_allowance(
        ref self: TContractState, spender: ContractAddress, subtracted_value: u256,
    ) -> bool;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;

    fn is_trusted_forwarder(self: @TContractState, forwarder: ContractAddress) -> bool;
    fn trusted_forwarder_contract(self: @TContractState) -> ContractAddress;
    fn admin_operations_contract(self: @TContractState) -> ContractAddress;

    fn update_admin_operations_address(
        ref self: TContractState, new_admin: ContractAddress,
    ) -> bool;
    fn update_forwarder_contract(
        ref self: TContractState, new_forwarder_contract: ContractAddress,
    ) -> bool;

    fn mint(ref self: TContractState, amount: u256, mint_to: ContractAddress) -> bool;
    fn burn_by_user(ref self: TContractState, amount: u256) -> bool;

    fn pause(ref self: TContractState) -> bool;
    fn unpause(ref self: TContractState) -> bool;

    fn destroy_black_funds(ref self: TContractState, blacklisted_user: ContractAddress) -> bool;
}

