#[starknet::contract]
pub mod Operations {
    use openzeppelin_access::ownable::OwnableComponent;
    use starknet::storage::*;
    use starknet::{ContractAddress, get_caller_address};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        can_forward: Map<ContractAddress, bool>,
        can_mint: Map<ContractAddress, bool>,
        mint_amount: Map<ContractAddress, u256>,
        trusted_contract: Map<ContractAddress, bool>,
        is_black_listed: Map<ContractAddress, bool>,
        is_external_sender_whitelisted: Map<ContractAddress, bool>,
        is_internal_user_whitelisted: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        AddedBlackList: AddedBlackList,
        RemovedBlackList: RemovedBlackList,
        MintAmountAdded: MintAmountAdded,
        MintAmountRemoved: MintAmountRemoved,
        WhitelistedForwarder: WhitelistedForwarder,
        BlackListedForwarder: BlackListedForwarder,
        WhitelistedMinter: WhitelistedMinter,
        BlackListedMinter: BlackListedMinter,
        WhitelistedContract: WhitelistedContract,
        BlackListedContract: BlackListedContract,
        WhitelistedExternalSender: WhitelistedExternalSender,
        BlackListedExternalSender: BlackListedExternalSender,
        WhitelistedInternalUser: WhitelistedInternalUser,
        BlackListedInternalUser: BlackListedInternalUser,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AddedBlackList {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RemovedBlackList {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MintAmountAdded {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MintAmountRemoved {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WhitelistedForwarder {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BlackListedForwarder {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WhitelistedMinter {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BlackListedMinter {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WhitelistedContract {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BlackListedContract {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WhitelistedExternalSender {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BlackListedExternalSender {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WhitelistedInternalUser {
        #[key]
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BlackListedInternalUser {
        #[key]
        pub user: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);

        self.can_forward.write(owner, true);
        self.can_mint.write(owner, true);
    }

    #[abi(embed_v0)]
    impl OperationsImpl of cngn::interface::IOperations::IAdmin<ContractState> {
        fn can_forward(self: @ContractState, user: ContractAddress) -> bool {
            self.can_forward.read(user)
        }

        fn can_mint(self: @ContractState, user: ContractAddress) -> bool {
            self.can_mint.read(user)
        }

        fn mint_amount(self: @ContractState, user: ContractAddress) -> u256 {
            self.mint_amount.read(user)
        }

        fn is_black_listed(self: @ContractState, user: ContractAddress) -> bool {
            self.is_black_listed.read(user)
        }

        fn trusted_contract(self: @ContractState, contract_address: ContractAddress) -> bool {
            self.trusted_contract.read(contract_address)
        }

        fn is_external_sender_whitelisted(self: @ContractState, user: ContractAddress) -> bool {
            self.is_external_sender_whitelisted.read(user)
        }

        fn is_internal_user_whitelisted(self: @ContractState, user: ContractAddress) -> bool {
            self.is_internal_user_whitelisted.read(user)
        }

        fn add_can_mint(ref self: ContractState, user: ContractAddress) -> bool {
            self._assert_only_owner_or_trusted_contract();
            self._assert_not_blacklisted(user);

            assert(!self.can_mint.read(user), 'User already added as minter');
            self.can_mint.write(user, true);
            self.emit(WhitelistedMinter { user });
            true
        }

        fn remove_can_mint(ref self: ContractState, user: ContractAddress) -> bool {
            self._assert_only_owner_or_trusted_contract();

            assert(self.can_mint.read(user), 'User is not a minter');
            self.can_mint.write(user, false);
            self.emit(BlackListedMinter { user });
            true
        }

        fn add_mint_amount(ref self: ContractState, user: ContractAddress, amount: u256) -> bool {
            self.ownable.assert_only_owner();

            assert(self.can_mint.read(user), 'User must be able to mint');
            self.mint_amount.write(user, amount);
            self.emit(MintAmountAdded { user });
            true
        }

        fn remove_mint_amount(ref self: ContractState, user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            self.mint_amount.write(user, 0);
            self.emit(MintAmountRemoved { user });
            true
        }

        fn whitelist_internal_user(ref self: ContractState, user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            assert(!self.is_internal_user_whitelisted.read(user), 'User already whitelisted');
            self.is_internal_user_whitelisted.write(user, true);
            self.emit(WhitelistedInternalUser { user });
            true
        }

        fn blacklist_internal_user(ref self: ContractState, user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            assert(self.is_internal_user_whitelisted.read(user), 'User not whitelisted');
            self.is_internal_user_whitelisted.write(user, false);
            self.emit(BlackListedInternalUser { user });
            true
        }

        fn whitelist_external_sender(ref self: ContractState, user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            assert(!self.is_external_sender_whitelisted.read(user), 'User already whitelisted');
            self.is_external_sender_whitelisted.write(user, true);
            self.emit(WhitelistedExternalSender { user });
            true
        }

        fn blacklist_external_sender(ref self: ContractState, user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            assert(self.is_external_sender_whitelisted.read(user), 'User not whitelisted');
            self.is_external_sender_whitelisted.write(user, false);
            self.emit(BlackListedExternalSender { user });
            true
        }

        fn add_can_forward(ref self: ContractState, user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();
            self._assert_not_blacklisted(user);

            assert(!self.can_forward.read(user), 'User already added as forwarder');
            self.can_forward.write(user, true);
            self.emit(WhitelistedForwarder { user });
            true
        }

        fn remove_can_forward(ref self: ContractState, user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            assert(self.can_forward.read(user), 'User is not a forwarder');
            self.can_forward.write(user, false);
            self.emit(BlackListedForwarder { user });
            true
        }

        fn add_trusted_contract(
            ref self: ContractState, contract_address: ContractAddress,
        ) -> bool {
            self.ownable.assert_only_owner();

            assert(!self.trusted_contract.read(contract_address), 'Contract already added');
            self.trusted_contract.write(contract_address, true);
            self.emit(WhitelistedContract { user: contract_address });
            true
        }

        fn remove_trusted_contract(
            ref self: ContractState, contract_address: ContractAddress,
        ) -> bool {
            self.ownable.assert_only_owner();

            assert(self.trusted_contract.read(contract_address), 'Contract does not exist');
            self.trusted_contract.write(contract_address, false);
            self.emit(BlackListedContract { user: contract_address });
            true
        }

        fn add_black_list(ref self: ContractState, evil_user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            assert(!self.is_black_listed.read(evil_user), 'User already blacklisted');
            self.is_black_listed.write(evil_user, true);
            self.emit(AddedBlackList { user: evil_user });
            true
        }

        fn remove_black_list(ref self: ContractState, cleared_user: ContractAddress) -> bool {
            self.ownable.assert_only_owner();

            assert(self.is_black_listed.read(cleared_user), 'Address not blacklisted');
            self.is_black_listed.write(cleared_user, false);
            self.emit(RemovedBlackList { user: cleared_user });
            true
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_only_owner_or_trusted_contract(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.ownable.owner();
            let is_trusted = self.trusted_contract.read(caller);

            assert(caller == owner || is_trusted, 'Not authorized');
        }

        fn _assert_not_blacklisted(self: @ContractState, user: ContractAddress) {
            assert(!self.is_black_listed.read(user), 'User is blacklisted');
        }
    }
}

