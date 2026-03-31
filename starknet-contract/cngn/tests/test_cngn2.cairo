use cngn::cngn2::{ICngn2Dispatcher, ICngn2DispatcherTrait};
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

fn deploy_cngn2(
    forwarder: ContractAddress, admin_ops: ContractAddress, owner: ContractAddress,
) -> ContractAddress {
    let contract = declare("Cngn2").unwrap().contract_class();
    let constructor_args = array![forwarder.into(), admin_ops.into(), owner.into()];
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

fn forwarder() -> ContractAddress {
    contract_address_const::<'FORWARDER'>()
}

fn zero_address() -> ContractAddress {
    contract_address_const::<0>()
}

// ========== DEPLOYMENT TESTS ==========

#[test]
fn test_cngn2_deployment() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();

    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);
    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    assert(dispatcher.total_supply() == 0, 'Initial supply should be 0');
    assert(dispatcher.trusted_forwarder_contract() == forwarder_addr, 'Forwarder should match');
    assert(dispatcher.admin_operations_contract() == admin_ops, 'Admin ops should match');
}

#[test]
fn test_is_trusted_forwarder() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();

    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);
    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    assert(dispatcher.is_trusted_forwarder(forwarder_addr), 'Should be trusted forwarder');
    assert(!dispatcher.is_trusted_forwarder(user1()), 'Should not be trusted');
}

// ========== ERC20 STANDARD TESTS ==========

#[test]
fn test_approve() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let spender = user1();
    let amount: u256 = 1000000; // 1 CNGN (6 decimals)

    start_cheat_caller_address(cngn2, owner_addr);
    let result = dispatcher.approve(spender, amount);
    stop_cheat_caller_address(cngn2);

    assert(result, 'Approve should return true');
    assert(dispatcher.allowance(owner_addr, spender) == amount, 'Allowance should match');
}

#[test]
fn test_balance_of_initial() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    assert(dispatcher.balance_of(owner_addr) == 0, 'Initial balance should be 0');
    assert(dispatcher.balance_of(user1()) == 0, 'User1 balance should be 0');
}


#[test]
fn test_update_admin_operations_address() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let new_admin_ops = deploy_operations(owner_addr);

    start_cheat_caller_address(cngn2, owner_addr);
    let result = dispatcher.update_admin_operations_address(new_admin_ops);
    stop_cheat_caller_address(cngn2);

    assert(result, 'Update should return true');
    assert(dispatcher.admin_operations_contract() == new_admin_ops, 'Admin ops should be updated');
}

#[test]
#[should_panic(expected: 'Admin address cannot be zero')]
fn test_update_admin_operations_zero_address() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    start_cheat_caller_address(cngn2, owner_addr);
    dispatcher.update_admin_operations_address(zero_address()); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
fn test_update_forwarder_contract() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let new_forwarder = user2();

    start_cheat_caller_address(cngn2, owner_addr);
    let result = dispatcher.update_forwarder_contract(new_forwarder);
    stop_cheat_caller_address(cngn2);

    assert(result, 'Update should return true');
    assert(dispatcher.trusted_forwarder_contract() == new_forwarder, 'Forwarder should be updated');
    assert(dispatcher.is_trusted_forwarder(new_forwarder), 'New forwarder should be trusted');
    assert(!dispatcher.is_trusted_forwarder(forwarder_addr), 'Old forwarder not trusted');
}

#[test]
#[should_panic(expected: 'Forwarder cannot be zero')]
fn test_update_forwarder_zero_address() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    start_cheat_caller_address(cngn2, owner_addr);
    dispatcher.update_forwarder_contract(zero_address()); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_update_admin_ops_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let attacker = user1();
    let new_admin_ops = user2();

    start_cheat_caller_address(cngn2, attacker);
    dispatcher.update_admin_operations_address(new_admin_ops); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_update_forwarder_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let attacker = user1();
    let new_forwarder = user2();

    start_cheat_caller_address(cngn2, attacker);
    dispatcher.update_forwarder_contract(new_forwarder); // Should panic
    stop_cheat_caller_address(cngn2);
}

// ========== PAUSE TESTS ==========

#[test]
fn test_pause_and_unpause() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    // Pause
    start_cheat_caller_address(cngn2, owner_addr);
    let pause_result = dispatcher.pause();
    stop_cheat_caller_address(cngn2);
    assert(pause_result, 'Pause should return true');

    // Unpause
    start_cheat_caller_address(cngn2, owner_addr);
    let unpause_result = dispatcher.unpause();
    stop_cheat_caller_address(cngn2);
    assert(unpause_result, 'Unpause should return true');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_pause_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let attacker = user1();

    start_cheat_caller_address(cngn2, attacker);
    dispatcher.pause(); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_transfer_when_paused() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    start_cheat_caller_address(cngn2, owner_addr);
    dispatcher.pause();
    stop_cheat_caller_address(cngn2);

    start_cheat_caller_address(cngn2, owner_addr);
    dispatcher.transfer(user1(), 0); // Should panic
    stop_cheat_caller_address(cngn2);
}

// ========== TRANSFER TESTS ==========

#[test]
fn test_zero_transfer() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    start_cheat_caller_address(cngn2, owner_addr);
    let result = dispatcher.transfer(user1(), 0);
    stop_cheat_caller_address(cngn2);

    assert(result, 'Zero transfer should work');
}

#[test]
fn test_zero_transfer_from() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let spender = user1();

    start_cheat_caller_address(cngn2, owner_addr);
    dispatcher.approve(spender, 1000000);
    stop_cheat_caller_address(cngn2);

    start_cheat_caller_address(cngn2, spender);
    let result = dispatcher.transfer_from(owner_addr, user2(), 0);
    stop_cheat_caller_address(cngn2);

    assert(result, 'Zero transfer_from should work');
}

// ========== BLACKLIST TRANSFER TESTS ==========

#[test]
#[should_panic(expected: 'Sender is blacklisted')]
fn test_transfer_blacklisted_sender() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let user = user1();

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_black_list(user);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, user);
    token_dispatcher.transfer(user2(), 0); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
#[should_panic(expected: 'Recipient is blacklisted')]
fn test_transfer_blacklisted_recipient() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let blacklisted = user1();

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_black_list(blacklisted);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, owner_addr);
    token_dispatcher.transfer(blacklisted, 0); // Should panic
    stop_cheat_caller_address(cngn2);
}

// ========== BURN BY USER TESTS ==========

#[test]
fn test_burn_by_user_zero() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    start_cheat_caller_address(cngn2, owner_addr);
    let result = dispatcher.burn_by_user(0);
    stop_cheat_caller_address(cngn2);

    assert(result, 'Burn zero should work');
}

#[test]
#[should_panic(expected: 'User is blacklisted')]
fn test_burn_blacklisted_user() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let user = user1();

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_black_list(user);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, user);
    token_dispatcher.burn_by_user(0); // Should panic
    stop_cheat_caller_address(cngn2);
}

// ========== DESTROY BLACK FUNDS TESTS ==========

#[test]
#[should_panic(expected: 'Not blacklisted')]
fn test_destroy_black_funds_not_blacklisted() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let user = user1();

    start_cheat_caller_address(cngn2, owner_addr);
    dispatcher.destroy_black_funds(user); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
fn test_destroy_black_funds_zero_balance() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let evil_user = user1();

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_black_list(evil_user);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, owner_addr);
    let result = token_dispatcher.destroy_black_funds(evil_user);
    stop_cheat_caller_address(cngn2);

    assert(result, 'Destroy should return true');
    assert(token_dispatcher.balance_of(evil_user) == 0, 'Balance should be 0');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_destroy_black_funds_non_owner() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let evil_user = user1();
    let attacker = user2();

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_black_list(evil_user);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, attacker);
    token_dispatcher.destroy_black_funds(evil_user); // Should panic
    stop_cheat_caller_address(cngn2);
}

// ========== MINT TESTS ==========

#[test]
#[should_panic(expected: 'Minter not authorized')]
fn test_mint_not_authorized() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };
    let user = user1();

    start_cheat_caller_address(cngn2, user);
    dispatcher.mint(1000000, user); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
#[should_panic(expected: 'Amount exceeds allowed')]
fn test_mint_wrong_amount() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let minter = user1();
    let authorized_amount: u256 = 1000000;
    let wrong_amount: u256 = 500000;

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_can_mint(minter);
    admin_dispatcher.add_mint_amount(minter, authorized_amount);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, minter);
    token_dispatcher.mint(wrong_amount, minter); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
#[should_panic(expected: 'Spender is blacklisted')]
fn test_transfer_from_blacklisted_spender() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let spender = user1();

    start_cheat_caller_address(cngn2, owner_addr);
    token_dispatcher.approve(spender, 1000000);
    stop_cheat_caller_address(cngn2);

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_black_list(spender);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, spender);
    token_dispatcher.transfer_from(owner_addr, user2(), 0); // Should panic
    stop_cheat_caller_address(cngn2);
}

#[test]
#[should_panic(expected: 'Sender is blacklisted')]
fn test_transfer_from_blacklisted_sender() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let admin_dispatcher = IAdminDispatcher { contract_address: admin_ops };
    let token_dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    let sender = user1();
    let spender = user2();

    start_cheat_caller_address(cngn2, sender);
    token_dispatcher.approve(spender, 1000000);
    stop_cheat_caller_address(cngn2);

    start_cheat_caller_address(admin_ops, owner_addr);
    admin_dispatcher.add_black_list(sender);
    stop_cheat_caller_address(admin_ops);

    start_cheat_caller_address(cngn2, spender);
    token_dispatcher.transfer_from(sender, owner_addr, 0); // Should panic
    stop_cheat_caller_address(cngn2);
}

// ========== VIEW FUNCTION TESTS ==========

#[test]
fn test_total_supply_after_deployment() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    assert(dispatcher.total_supply() == 0, 'Initial supply should be 0');
}

#[test]
fn test_allowance_initial() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn2 = deploy_cngn2(forwarder_addr, admin_ops, owner_addr);

    let dispatcher = ICngn2Dispatcher { contract_address: cngn2 };

    assert(dispatcher.allowance(owner_addr, user1()) == 0, 'Initial allowance should be 0');
}

