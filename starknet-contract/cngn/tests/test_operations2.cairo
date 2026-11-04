use cngn::interface::IOperations::{IAdminDispatcher, IAdminDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress, contract_address_const};

fn deploy_operations2(owner: ContractAddress) -> ContractAddress {
    let contract = declare("Operations2").unwrap().contract_class();
    let constructor_args = array![owner.into()];
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

fn trusted_contract() -> ContractAddress {
    contract_address_const::<'TRUSTED'>()
}

// ========== INITIALIZATION TESTS ==========

#[test]
fn test_constructor_sets_owner_permissions() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    assert(dispatcher.can_forward(owner_addr), 'Owner should be able to forward');
    assert(dispatcher.can_mint(owner_addr), 'Owner should be able to mint');
}

// ========== PAUSABLE TESTS (V2 SPECIFIC) ==========

#[test]
fn test_operations_work_when_not_paused() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);

    let result1 = dispatcher.add_can_mint(user);
    assert(result1, 'add_can_mint should work');

    let result2 = dispatcher.add_mint_amount(user, 1000000);
    assert(result2, 'add_mint_amount should work');

    let result3 = dispatcher.add_can_forward(user2());
    assert(result3, 'add_can_forward should work');

    stop_cheat_caller_address(contract_address);
}

#[test]
fn test_remove_can_mint_also_clears_mint_amount() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();
    let amount: u256 = 1000000;

    start_cheat_caller_address(contract_address, owner_addr);

    dispatcher.add_can_mint(user);
    dispatcher.add_mint_amount(user, amount);

    assert(dispatcher.mint_amount(user) == amount, 'Mint amount should be set');

    dispatcher.remove_can_mint(user);

    assert(dispatcher.mint_amount(user) == 0, 'Mint amount should be cleared');

    stop_cheat_caller_address(contract_address);
}

// ========== ENHANCED REMOVE_MINT_AMOUNT ACCESS (V2 SPECIFIC) ==========

#[test]
fn test_trusted_contract_can_remove_mint_amount() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let trusted = trusted_contract();
    let user = user1();
    let amount: u256 = 1000000;

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_can_mint(user);
    dispatcher.add_mint_amount(user, amount);
    dispatcher.add_trusted_contract(trusted);
    stop_cheat_caller_address(contract_address);

    start_cheat_caller_address(contract_address, trusted);
    let result = dispatcher.remove_mint_amount(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'Trusted should remove amount');
    assert(dispatcher.mint_amount(user) == 0, 'Amount should be 0');
}

// ========== BASIC FUNCTIONALITY TESTS ==========

#[test]
fn test_add_can_mint() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_can_mint should return true');
    assert(dispatcher.can_mint(user), 'User should be able to mint');
}

#[test]
fn test_add_mint_amount() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();
    let amount: u256 = 1000000;

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_can_mint(user);
    let result = dispatcher.add_mint_amount(user, amount);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_mint_amount should ret true');
    assert(dispatcher.mint_amount(user) == amount, 'Mint amount should match');
}

#[test]
fn test_add_can_forward() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.add_can_forward(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_can_forward should ret true');
    assert(dispatcher.can_forward(user), 'User should be able to forward');
}

#[test]
fn test_add_trusted_contract() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let trusted = trusted_contract();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.add_trusted_contract(trusted);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_trusted_contract ret true');
    assert(dispatcher.trusted_contract(trusted), 'Should be trusted');
}

// ========== BLACKLIST TESTS ==========

#[test]
fn test_add_black_list() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let evil_user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.add_black_list(evil_user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_black_list should ret true');
    assert(dispatcher.is_black_listed(evil_user), 'User should be blacklisted');
}

#[test]
fn test_remove_black_list() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_black_list(user);
    let result = dispatcher.remove_black_list(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'remove_black_list ret true');
    assert(!dispatcher.is_black_listed(user), 'User should not be blacklisted');
}

// ========== WHITELIST TESTS ==========

#[test]
fn test_whitelist_internal_user() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.whitelist_internal_user(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'whitelist_internal ret true');
    assert(dispatcher.is_internal_user_whitelisted(user), 'User should be whitelisted');
}

#[test]
fn test_whitelist_external_sender() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.whitelist_external_sender(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'whitelist_external ret true');
    assert(dispatcher.is_external_sender_whitelisted(user), 'User should be whitelisted');
}

// ========== ACCESS CONTROL TESTS ==========

#[test]
#[should_panic(expected: 'Not authorized')]
fn test_non_owner_cannot_add_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let attacker = user1();
    let user = user2();

    start_cheat_caller_address(contract_address, attacker);
    dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'User is blacklisted')]
fn test_cannot_add_blacklisted_user_as_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations2(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_black_list(user);
    dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);
}

