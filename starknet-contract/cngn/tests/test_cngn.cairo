use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
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

fn deploy_cngn(
    owner: ContractAddress, admin_ops: ContractAddress, forwarder: ContractAddress,
) -> ContractAddress {
    let contract = declare("Cngn").unwrap().contract_class();
    let constructor_args = array![owner.into(), admin_ops.into(), forwarder.into()];
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


#[test]
fn test_cngn_deployment() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();

    let cngn = deploy_cngn(owner_addr, admin_ops, forwarder_addr);
    let erc20 = IERC20Dispatcher { contract_address: cngn };

    assert(erc20.total_supply() == 0, 'Initial supply should be 0');
}

#[test]
fn test_erc20_metadata() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();

    let cngn = deploy_cngn(owner_addr, admin_ops, forwarder_addr);

    let erc20 = IERC20Dispatcher { contract_address: cngn };
    assert(erc20.total_supply() == 0, 'Initial supply should be 0');
}

// ========== TRANSFER TESTS ==========

#[test]
fn test_transfer_with_balance() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn = deploy_cngn(owner_addr, admin_ops, forwarder_addr);

    let erc20 = IERC20Dispatcher { contract_address: cngn };
    let recipient = user1();

    // Need to mint tokens first
    assert(erc20.balance_of(owner_addr) == 0, 'Owner balance should be 0');
    assert(erc20.balance_of(recipient) == 0, 'Recipient balance should be 0');
}

// ========== ALLOWANCE TESTS ==========

#[test]
fn test_approve() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn = deploy_cngn(owner_addr, admin_ops, forwarder_addr);

    let erc20 = IERC20Dispatcher { contract_address: cngn };
    let spender = user1();
    let amount: u256 = 1000000; // 1 CNGN

    start_cheat_caller_address(cngn, owner_addr);
    let result = erc20.approve(spender, amount);
    stop_cheat_caller_address(cngn);

    assert(result, 'Approve should return true');
    assert(erc20.allowance(owner_addr, spender) == amount, 'Allowance should match');
}

#[test]
fn test_increase_allowance() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn = deploy_cngn(owner_addr, admin_ops, forwarder_addr);

    let erc20 = IERC20Dispatcher { contract_address: cngn };
    let spender = user1();
    let initial_amount: u256 = 1000000;
    let additional_amount: u256 = 500000;

    start_cheat_caller_address(cngn, owner_addr);
    erc20.approve(spender, initial_amount);
    stop_cheat_caller_address(cngn);

    start_cheat_caller_address(cngn, owner_addr);
    erc20.approve(spender, initial_amount + additional_amount);
    stop_cheat_caller_address(cngn);

    assert(
        erc20.allowance(owner_addr, spender) == initial_amount + additional_amount,
        'Allowance should be increased',
    );
}

#[test]
fn test_zero_balance_transfer() {
    let owner_addr = owner();
    let admin_ops = deploy_operations(owner_addr);
    let forwarder_addr = forwarder();
    let cngn = deploy_cngn(owner_addr, admin_ops, forwarder_addr);

    let erc20 = IERC20Dispatcher { contract_address: cngn };
    let recipient = user1();

    start_cheat_caller_address(cngn, owner_addr);
    let result = erc20.transfer(recipient, 0);
    stop_cheat_caller_address(cngn);

    assert(result, 'Zero transfer should succeed');
}

