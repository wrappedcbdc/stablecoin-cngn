#[starknet::contract]
pub mod Forwarder {
    use cngn::interface::IOperations::{IAdminDispatcher, IAdminDispatcherTrait};
    use core::hash::{HashStateExTrait, HashStateTrait};
    use core::poseidon::PoseidonTrait;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::accounts::{ISRC6Dispatcher, ISRC6DispatcherTrait};
    use openzeppelin_security::pausable::PausableComponent;
    use starknet::storage::*;
    use starknet::syscalls::call_contract_syscall;
    use starknet::{ContractAddress, get_caller_address};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    // TODO : check if this is correct
    // SNIP-12 Type Hash for ForwardRequest struct
    // Computed as: starknet_keccak(encode_type(ForwardRequest))
    // encode_type =
    // "ForwardRequest"("from":"ContractAddress","to":"ContractAddress","value":"u256","gas":"u256","nonce":"felt","data":"felt*")"u256"("low":"u128","high":"u128")
    const FORWARD_REQUEST_TYPE_HASH: felt252 = selector!(
        "\"ForwardRequest\"(\"from\":\"ContractAddress\",\"to\":\"ContractAddress\",\"value\":\"u256\",\"gas\":\"u256\",\"nonce\":\"felt\",\"data\":\"felt*\")\"u256\"(\"low\":\"u128\",\"high\":\"u128\")",
    );

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        admin_operations_contract: ContractAddress,
        authorized_bridges: Map<ContractAddress, bool>,
        processed_tx_hashes: Map<felt252, bool>,
        nonces: Map<ContractAddress, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        BridgeAuthorized: BridgeAuthorized,
        BridgeDeauthorized: BridgeDeauthorized,
        AdminOperationsAddressUpdated: AdminOperationsAddressUpdated,
        Executed: Executed,
        NonceIncremented: NonceIncremented,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BridgeAuthorized {
        #[key]
        pub bridge_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BridgeDeauthorized {
        #[key]
        pub bridge_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AdminOperationsAddressUpdated {
        #[key]
        pub new_admin_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Executed {
        #[key]
        pub relayer: ContractAddress,
        pub success: bool,
        pub return_data: Span<felt252>,
    }

    #[derive(Drop, starknet::Event)]
    pub struct NonceIncremented {
        #[key]
        pub from: ContractAddress,
        pub new_nonce: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, admin_operations_contract: ContractAddress, owner: ContractAddress,
    ) {
        self.ownable.initializer(owner);

        self.admin_operations_contract.write(admin_operations_contract);
    }

    #[abi(embed_v0)]
    impl ForwarderImpl of super::IForwarder<ContractState> {
        fn get_nonce(self: @ContractState, from: ContractAddress) -> felt252 {
            self.nonces.read(from)
        }

        fn admin_operations_contract(self: @ContractState) -> ContractAddress {
            self.admin_operations_contract.read()
        }

        fn is_authorized_bridge(self: @ContractState, bridge: ContractAddress) -> bool {
            self.authorized_bridges.read(bridge)
        }

        fn is_processed(self: @ContractState, tx_hash: felt252) -> bool {
            self.processed_tx_hashes.read(tx_hash)
        }

        fn update_admin_operations_address(
            ref self: ContractState, new_admin: ContractAddress,
        ) -> bool {
            self.ownable.assert_only_owner();
            self.admin_operations_contract.write(new_admin);
            self.emit(AdminOperationsAddressUpdated { new_admin_address: new_admin });
            true
        }

        fn authorize_bridge(ref self: ContractState, bridge_address: ContractAddress) {
            self.ownable.assert_only_owner();
            self.authorized_bridges.write(bridge_address, true);
            self.emit(BridgeAuthorized { bridge_address });
        }

        fn deauthorize_bridge(ref self: ContractState, bridge_address: ContractAddress) {
            self.ownable.assert_only_owner();
            self.authorized_bridges.write(bridge_address, false);
            self.emit(BridgeDeauthorized { bridge_address });
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }

        fn verify(
            self: @ContractState, req: super::ForwardRequest, signature: Span<felt252>,
        ) -> bool {
            let message_hash = self._compute_message_hash(@req);

            let current_nonce: felt252 = self.nonces.read(req.from);

            if req.nonce != current_nonce {
                return false;
            }

            let account = ISRC6Dispatcher { contract_address: req.from };
            let mut signature_array = array![];
            let mut i = 0;
            loop {
                if i >= signature.len() {
                    break;
                }
                signature_array.append(*signature.at(i));
                i += 1;
            }

            let is_valid = account.is_valid_signature(message_hash, signature_array);

            is_valid == starknet::VALIDATED || is_valid == 1
        }

        fn execute(
            ref self: ContractState, req: super::ForwardRequest, signature: Span<felt252>,
        ) -> (bool, Span<felt252>) {
            self.ownable.assert_only_owner();
            self.pausable.assert_not_paused();
            self._execute_transaction(req, signature)
        }

        fn execute_by_bridge(
            ref self: ContractState, req: super::ForwardRequest, signature: Span<felt252>,
        ) -> (bool, Span<felt252>) {
            let caller = get_caller_address();
            assert(self.authorized_bridges.read(caller), 'Unauthorized bridge');
            self.pausable.assert_not_paused();
            self._execute_transaction(req, signature)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _compute_message_hash(self: @ContractState, req: @super::ForwardRequest) -> felt252 {
            let hash_state = PoseidonTrait::new();

            let mut data_hash_state = PoseidonTrait::new();
            let mut i = 0;
            loop {
                if i >= (*req.data).len() {
                    break;
                }
                data_hash_state = data_hash_state.update(*(*req.data).at(i));
                i += 1;
            }
            let data_hash = data_hash_state.finalize();

            hash_state
                .update_with(FORWARD_REQUEST_TYPE_HASH)
                .update((*req.from).into())
                .update((*req.to).into())
                .update_with(*req.value)
                .update_with(*req.gas)
                .update((*req.nonce))
                .update(data_hash)
                .finalize()
        }

        fn _compute_tx_hash(self: @ContractState, req: @super::ForwardRequest) -> felt252 {
            let hash_state = PoseidonTrait::new();

            let mut data_hash_state = PoseidonTrait::new();
            let mut i = 0;
            loop {
                if i >= (*req.data).len() {
                    break;
                }
                data_hash_state = data_hash_state.update(*(*req.data).at(i));
                i += 1;
            }
            let data_hash = data_hash_state.finalize();

            hash_state
                .update((*req.from).into())
                .update((*req.to).into())
                .update_with(*req.value)
                .update((*req.nonce))
                .update(data_hash)
                .finalize()
        }

        fn _execute_transaction(
            ref self: ContractState, req: super::ForwardRequest, signature: Span<felt252>,
        ) -> (bool, Span<felt252>) {
            let caller = get_caller_address();
            let admin_contract = IAdminDispatcher {
                contract_address: self.admin_operations_contract.read(),
            };

            assert(admin_contract.can_forward(req.from), 'Route not allowed');

            assert(!admin_contract.is_black_listed(caller), 'Relayer blacklisted');

            assert(!admin_contract.is_black_listed(req.from), 'Signer blacklisted');

            assert(self.verify(req, signature), 'Invalid signature or nonce');

            let tx_hash = self._compute_tx_hash(@req);
            assert(!self.processed_tx_hashes.read(tx_hash), 'Replay attack prevented');
            self.processed_tx_hashes.write(tx_hash, true);

            let current_nonce = self.nonces.read(req.from);
            self.nonces.write(req.from, current_nonce + 1);
            self.emit(NonceIncremented { from: req.from, new_nonce: current_nonce + 1 });

            let mut calldata = array![];
            let mut i = 0;
            loop {
                if i >= req.data.len() {
                    break;
                }
                calldata.append(*req.data.at(i));
                i += 1;
            }
            calldata.append(req.from.into());

            let result = call_contract_syscall(req.to, selector!("forward_call"), calldata.span());

            let (success, return_data) = match result {
                Result::Ok(data) => (true, data),
                Result::Err(_) => (false, array![].span()),
            };

            self.emit(Executed { relayer: caller, success, return_data });

            (success, return_data)
        }
    }
}
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
pub struct ForwardRequest {
    pub from: ContractAddress,
    pub to: ContractAddress,
    pub value: u256,
    pub gas: u256,
    pub nonce: felt252,
    pub data: Span<felt252>,
}

#[starknet::interface]
pub trait IForwarder<TContractState> {
    fn get_nonce(self: @TContractState, from: ContractAddress) -> felt252;
    fn admin_operations_contract(self: @TContractState) -> ContractAddress;
    fn is_authorized_bridge(self: @TContractState, bridge: ContractAddress) -> bool;
    fn is_processed(self: @TContractState, tx_hash: felt252) -> bool;

    fn update_admin_operations_address(
        ref self: TContractState, new_admin: ContractAddress,
    ) -> bool;
    fn authorize_bridge(ref self: TContractState, bridge_address: ContractAddress);
    fn deauthorize_bridge(ref self: TContractState, bridge_address: ContractAddress);

    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);

    fn verify(self: @TContractState, req: ForwardRequest, signature: Span<felt252>) -> bool;

    fn execute(
        ref self: TContractState, req: ForwardRequest, signature: Span<felt252>,
    ) -> (bool, Span<felt252>);
    fn execute_by_bridge(
        ref self: TContractState, req: ForwardRequest, signature: Span<felt252>,
    ) -> (bool, Span<felt252>);
}

