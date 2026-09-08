use cngn::forwarder::{IForwarderDispatcher, IForwarderDispatcherTrait};
use cngn::interface::IOperations::{IAdminDispatcher, IAdminDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress, contract_address_const};

fn deploy_operations(owner: ContractAddress) -> ContractAddress {
    let contract = declare("Operations").unwrap().contract_class();
    let constructor_args = array![owner.into()];
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    contract_address
}

fn deploy_forwarder(admin_ops: ContractAddress, owner: ContractAddress) -> ContractAddress {
    let contract = declare("Forwarder").unwrap().contract_class();
    let constructor_args = array![admin_ops.into(), owner.into()];
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    contract_address
}

fn owner() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn user1() -> ContractAddress {
    contract_address_const::<'USER1'>()
}

fn user2() -> ContractAddress {
    contract_address_const::<'USER2'>()
}

fn bridge1() -> ContractAddress {
    contract_address_const::<'BRIDGE1'>()
}

fn bridge2() -> ContractAddress {
    contract_address_const::<'BRIDGE2'>()
}

// ========== DEPLOYMENT TESTS ==========

#[test]
fn test_forwarder_deployment() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };

    assert(dispatcher.admin_operations_contract() == admin_ops, 'Admin ops should match');
}

#[test]
fn test_initial_nonce_is_zero() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };

    assert(dispatcher.get_nonce(user1()) == 0, 'Initial nonce should be 0');
    assert(dispatcher.get_nonce(user2()) == 0, 'Initial nonce should be 0');
}

// ========== BRIDGE AUTHORIZATION TESTS ==========

#[test]
fn test_authorize_bridge() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let bridge = bridge1();

    assert(!dispatcher.is_authorized_bridge(bridge), 'Bridge not authorized yet');

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.authorize_bridge(bridge);
    stop_cheat_caller_address(forwarder);

    assert(dispatcher.is_authorized_bridge(bridge), 'Bridge should be authorized');
}

#[test]
fn test_deauthorize_bridge() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let bridge = bridge1();

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.authorize_bridge(bridge);
    stop_cheat_caller_address(forwarder);

    assert(dispatcher.is_authorized_bridge(bridge), 'Bridge should be authorized');

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.deauthorize_bridge(bridge);
    stop_cheat_caller_address(forwarder);

    assert(!dispatcher.is_authorized_bridge(bridge), 'Bridge should be deauthorized');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_authorize_bridge_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let attacker = user1();

    start_cheat_caller_address(forwarder, attacker);
    dispatcher.authorize_bridge(bridge1()); // Should panic
    stop_cheat_caller_address(forwarder);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_deauthorize_bridge_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let attacker = user1();

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.authorize_bridge(bridge1());
    stop_cheat_caller_address(forwarder);

    start_cheat_caller_address(forwarder, attacker);
    dispatcher.deauthorize_bridge(bridge1()); // Should panic
    stop_cheat_caller_address(forwarder);
}

// ========== ADMIN OPERATIONS UPDATE TESTS ==========

#[test]
fn test_update_admin_operations_address() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let new_admin_ops = deploy_operations(owner_addr);

    start_cheat_caller_address(forwarder, owner_addr);
    let result = dispatcher.update_admin_operations_address(new_admin_ops);
    stop_cheat_caller_address(forwarder);

    assert(result, 'Update should return true');
    assert(dispatcher.admin_operations_contract() == new_admin_ops, 'Admin ops should be updated');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_update_admin_operations_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let attacker = user1();

    start_cheat_caller_address(forwarder, attacker);
    dispatcher.update_admin_operations_address(user2()); // Should panic
    stop_cheat_caller_address(forwarder);
}

// ========== PAUSE TESTS ==========

#[test]
fn test_pause_and_unpause() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.pause();
    stop_cheat_caller_address(forwarder);

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.unpause();
    stop_cheat_caller_address(forwarder);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_pause_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let attacker = user1();

    start_cheat_caller_address(forwarder, attacker);
    dispatcher.pause(); // Should panic
    stop_cheat_caller_address(forwarder);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_unpause_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let attacker = user1();

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.pause();
    stop_cheat_caller_address(forwarder);

    start_cheat_caller_address(forwarder, attacker);
    dispatcher.unpause(); // Should panic
    stop_cheat_caller_address(forwarder);
}

// ========== PROCESSED TX HASH TESTS ==========

#[test]
fn test_tx_hash_not_processed_initially() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };
    let random_hash: felt252 = 0x123456789;

    assert(!dispatcher.is_processed(random_hash), 'Hash should not be processed');
}

// ========== MULTIPLE BRIDGES TEST ==========

#[test]
fn test_multiple_bridges_authorization() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder = deploy_forwarder(admin_ops, owner_addr);

    let dispatcher = IForwarderDispatcher { contract_address: forwarder };

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.authorize_bridge(bridge1());
    dispatcher.authorize_bridge(bridge2());
    stop_cheat_caller_address(forwarder);

    assert(dispatcher.is_authorized_bridge(bridge1()), 'Bridge1 should be authorized');
    assert(dispatcher.is_authorized_bridge(bridge2()), 'Bridge2 should be authorized');

    start_cheat_caller_address(forwarder, owner_addr);
    dispatcher.deauthorize_bridge(bridge1());
    stop_cheat_caller_address(forwarder);

    assert(!dispatcher.is_authorized_bridge(bridge1()), 'Bridge1 should be deauthorized');
    assert(dispatcher.is_authorized_bridge(bridge2()), 'Bridge2 still authorized');
}

