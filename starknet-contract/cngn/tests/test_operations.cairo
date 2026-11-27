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
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    assert(dispatcher.can_forward(owner_addr), 'Owner should be able to forward');
    assert(dispatcher.can_mint(owner_addr), 'Owner should be able to mint');
}

#[test]
fn test_initial_mappings_are_false() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();
    assert(!dispatcher.can_forward(user), 'User should not forward');
    assert(!dispatcher.can_mint(user), 'User should not mint');
    assert(!dispatcher.is_black_listed(user), 'User should not be blacklisted');
    assert(!dispatcher.is_external_sender_whitelisted(user), 'User not external whitelisted');
    assert(!dispatcher.is_internal_user_whitelisted(user), 'User not internal whitelisted');
    assert(dispatcher.mint_amount(user) == 0, 'Mint amount should be 0');
}

// ========== MINTING PERMISSION TESTS ==========

#[test]
fn test_add_can_mint() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_can_mint should return true');
    assert(dispatcher.can_mint(user), 'User should be able to mint');
}

#[test]
fn test_remove_can_mint() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_can_mint(user);
    let result = dispatcher.remove_can_mint(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'remove_can_mint should ret true');
    assert(!dispatcher.can_mint(user), 'User should not mint');
}

#[test]
#[should_panic(expected: 'User already added as minter')]
fn test_add_can_mint_already_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_can_mint(user);
    dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'User is not a minter')]
fn test_remove_can_mint_not_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.remove_can_mint(user); // Should panic
    stop_cheat_caller_address(contract_address);
}

// ========== MINT AMOUNT TESTS ==========

#[test]
fn test_add_mint_amount() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();
    let amount: u256 = 1000000; // 1 CNGN (6 decimals)

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_can_mint(user);
    let result = dispatcher.add_mint_amount(user, amount);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_mint_amount should ret true');
    assert(dispatcher.mint_amount(user) == amount, 'Mint amount should match');
}

#[test]
fn test_remove_mint_amount() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();
    let amount: u256 = 1000000;

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_can_mint(user);
    dispatcher.add_mint_amount(user, amount);
    let result = dispatcher.remove_mint_amount(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'remove_mint_amount ret true');
    assert(dispatcher.mint_amount(user) == 0, 'Mint amount should be 0');
}

#[test]
#[should_panic(expected: 'User must be able to mint')]
fn test_add_mint_amount_not_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_mint_amount(user, 1000000);
    stop_cheat_caller_address(contract_address);
}

// ========== FORWARDER TESTS ==========

#[test]
fn test_add_can_forward() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.add_can_forward(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_can_forward should ret true');
    assert(dispatcher.can_forward(user), 'User should be able to forward');
}

#[test]
fn test_remove_can_forward() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_can_forward(user);
    let result = dispatcher.remove_can_forward(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'remove_can_forward ret true');
    assert(!dispatcher.can_forward(user), 'User should not forward');
}

// ========== TRUSTED CONTRACT TESTS ==========

#[test]
fn test_add_trusted_contract() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let trusted = trusted_contract();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.add_trusted_contract(trusted);
    stop_cheat_caller_address(contract_address);

    assert(result, 'add_trusted_contract ret true');
    assert(dispatcher.trusted_contract(trusted), 'Should be trusted');
}

#[test]
fn test_trusted_contract_can_add_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let trusted = trusted_contract();
    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_trusted_contract(trusted);
    stop_cheat_caller_address(contract_address);

    start_cheat_caller_address(contract_address, trusted);
    let result = dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'Trusted should add minter');
    assert(dispatcher.can_mint(user), 'User should be minter');
}

// ========== BLACKLIST TESTS ==========

#[test]
fn test_add_black_list() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
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
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_black_list(user);
    let result = dispatcher.remove_black_list(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'remove_black_list ret true');
    assert(!dispatcher.is_black_listed(user), 'User should not be blacklisted');
}

#[test]
#[should_panic(expected: 'User is blacklisted')]
fn test_cannot_add_blacklisted_user_as_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_black_list(user);
    dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'User is blacklisted')]
fn test_cannot_add_blacklisted_user_as_forwarder() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.add_black_list(user);
    dispatcher.add_can_forward(user);
    stop_cheat_caller_address(contract_address);
}

// ========== WHITELIST TESTS ==========

#[test]
fn test_whitelist_internal_user() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
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
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    let result = dispatcher.whitelist_external_sender(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'whitelist_external ret true');
    assert(dispatcher.is_external_sender_whitelisted(user), 'User should be whitelisted');
}

#[test]
fn test_blacklist_internal_user() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let user = user1();

    start_cheat_caller_address(contract_address, owner_addr);
    dispatcher.whitelist_internal_user(user);
    let result = dispatcher.blacklist_internal_user(user);
    stop_cheat_caller_address(contract_address);

    assert(result, 'blacklist_internal ret true');
    assert(!dispatcher.is_internal_user_whitelisted(user), 'User should not be whitelisted');
}

// ========== ACCESS CONTROL TESTS ==========

#[test]
#[should_panic(expected: 'Not authorized')]
fn test_non_owner_cannot_add_minter() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let attacker = user1();
    let user = user2();

    start_cheat_caller_address(contract_address, attacker);
    dispatcher.add_can_mint(user);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_add_forwarder() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let attacker = user1();
    let user = user2();

    start_cheat_caller_address(contract_address, attacker);
    dispatcher.add_can_forward(user); // should panic
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_blacklist() {
    let owner_addr = owner();
    let contract_address = deploy_operations(owner_addr);
    let dispatcher = IAdminDispatcher { contract_address };

    let attacker = user1();
    let user = user2();

    start_cheat_caller_address(contract_address, attacker);
    dispatcher.add_black_list(user); // should panic
    stop_cheat_caller_address(contract_address);
}

