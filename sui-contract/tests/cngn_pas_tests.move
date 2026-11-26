// SPDX-License-Identifier: MIT

#[test_only]
module cngn::cngn_pas_tests;

use cngn::admin::{Self, AdminCap, AdminRegistry};
use cngn::cngn_pas::{Self, CNGN_PAS, CoinState};
use pas::account::{Self, Account};
use pas::namespace::{Self, Namespace};
use pas::policy::Policy;
use pas::send_funds;
use std::unit_test::assert_eq;
use sui::deny_list::{Self, DenyList};
use sui::test_scenario::{Self as ts, Scenario};

const ADMIN: address = @0xAD;
const MINTER: address = @0xB0B;
const ALICE: address = @0xA11CE;
const BOB: address = @0xB0B2;
const MINT_AMOUNT: u64 = 50_000_000_000; // 50,000 cNGN (6 decimals)
const HALF_MINT_AMOUNT: u64 = 25_000_000_000;

fun setup(): Scenario {
    let mut scenario = ts::begin(@0x0);
    {
        deny_list::create_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
        cngn_pas::init_for_testing(scenario.ctx());
    };
    scenario
}

fun setup_namespace_for_testing(scenario: &mut Scenario): Namespace {
    let mut namespace = namespace::create_for_testing(scenario.ctx());
    let package_id = sui::address::from_ascii_bytes(
        std::type_name::with_defining_ids<Namespace>().address_string().as_bytes()
    ).to_id();
    let upgrade_cap = sui::package::test_publish(package_id, scenario.ctx());
    namespace.setup(&upgrade_cap);
    sui::transfer::public_transfer(upgrade_cap, ADMIN);
    namespace
}

#[test]
fun token_pas_pure_mint_and_compliant_transfer() {
    let mut scenario = setup();

    // 1. Setup Namespace & Policy
    scenario.next_tx(ADMIN);
    {
        let mut namespace = setup_namespace_for_testing(&mut scenario);
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();

        let policy_cap = state.setup_pas_policy(&cap, &mut namespace);

        account::create_and_share(&mut namespace, ALICE);
        account::create_and_share(&mut namespace, BOB);

        namespace.share_for_testing();
        sui::transfer::public_transfer(policy_cap, ADMIN);
        scenario.return_to_sender(cap);
        ts::return_shared(state);
    };

    // 2. Admin grants mint permission to MINTER
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // 3. MINTER mints directly into ALICE's PAS Account
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let alice_account = scenario.take_shared_by_id<Account>(alice_account_id);

        state.mint_to_account(
            &mut registry,
            &deny_list,
            &alice_account,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        assert_eq!(state.total_supply(), MINT_AMOUNT);

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(alice_account);
    };

    // 4. ALICE sends to BOB via PAS
    scenario.next_tx(ALICE);
    {
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();
        let policy = scenario.take_shared<Policy<sui::balance::Balance<CNGN_PAS>>>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let bob_account_id = namespace.account_address(BOB).to_id();
        let mut alice_account = scenario.take_shared_by_id<Account>(alice_account_id);
        let bob_account = scenario.take_shared_by_id<Account>(bob_account_id);

        let auth = account::new_auth(scenario.ctx());
        let mut transfer_request = alice_account.send_balance<CNGN_PAS>(
            &auth,
            &bob_account,
            HALF_MINT_AMOUNT,
            scenario.ctx(),
        );

        cngn_pas::approve_pas_transfer(&deny_list, &mut transfer_request);
        send_funds::resolve_balance(transfer_request, &policy);

        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(policy);
        ts::return_shared(alice_account);
        ts::return_shared(bob_account);
    };

    scenario.end();
}

#[test]
fun token_pas_pure_user_self_burn() {
    let mut scenario = setup();

    // 1. Setup Namespace & Policy
    scenario.next_tx(ADMIN);
    {
        let mut namespace = setup_namespace_for_testing(&mut scenario);
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();

        let policy_cap = state.setup_pas_policy(&cap, &mut namespace);

        account::create_and_share(&mut namespace, ALICE);

        namespace.share_for_testing();
        sui::transfer::public_transfer(policy_cap, ADMIN);
        scenario.return_to_sender(cap);
        ts::return_shared(state);
    };

    // 2. Admin grants mint permission to MINTER
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // 3. MINTER mints into ALICE's PAS Account
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let alice_account = scenario.take_shared_by_id<Account>(alice_account_id);

        state.mint_to_account(
            &mut registry,
            &deny_list,
            &alice_account,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        assert_eq!(state.total_supply(), MINT_AMOUNT);

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(alice_account);
    };

    // 4. ALICE burns her tokens from PAS account
    scenario.next_tx(ALICE);
    {
        let mut state = scenario.take_shared<CoinState>();
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();
        let policy = scenario.take_shared<Policy<sui::balance::Balance<CNGN_PAS>>>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let mut alice_account = scenario.take_shared_by_id<Account>(alice_account_id);

        let auth = account::new_auth(scenario.ctx());
        state.burn_from_pas_account(
            &deny_list,
            &policy,
            &mut alice_account,
            &auth,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        assert_eq!(state.total_supply(), 0);

        ts::return_shared(state);
        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(policy);
        ts::return_shared(alice_account);
    };

    scenario.end();
}

#[test]
fun token_pas_pure_admin_clawback_and_burn() {
    let mut scenario = setup();

    // 1. Setup Namespace & Policy
    scenario.next_tx(ADMIN);
    {
        let mut namespace = setup_namespace_for_testing(&mut scenario);
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();

        let policy_cap = state.setup_pas_policy(&cap, &mut namespace);

        account::create_and_share(&mut namespace, ALICE);

        namespace.share_for_testing();
        sui::transfer::public_transfer(policy_cap, ADMIN);
        scenario.return_to_sender(cap);
        ts::return_shared(state);
    };

    // 2. Admin grants mint permission to MINTER
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // 3. MINTER mints into ALICE's PAS Account
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let alice_account = scenario.take_shared_by_id<Account>(alice_account_id);

        state.mint_to_account(
            &mut registry,
            &deny_list,
            &alice_account,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(alice_account);
    };

    // 4. Admin blacklists ALICE
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        state.add_black_list(&cap, &mut deny_list, ALICE, scenario.ctx());

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    // 5. Admin claws back and burns from ALICE's PAS Account
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();
        let policy = scenario.take_shared<Policy<sui::balance::Balance<CNGN_PAS>>>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let mut alice_account = scenario.take_shared_by_id<Account>(alice_account_id);

        state.destroy_black_funds(
            &cap,
            &policy,
            &mut alice_account,
            &deny_list,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        assert_eq!(state.total_supply(), 0);

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(policy);
        ts::return_shared(alice_account);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn_pas::ENotBlacklisted)]
fun token_pas_pure_destroy_black_funds_not_blacklisted_fails() {
    let mut scenario = setup();

    // 1. Setup Namespace & Policy
    scenario.next_tx(ADMIN);
    {
        let mut namespace = setup_namespace_for_testing(&mut scenario);
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();

        let policy_cap = state.setup_pas_policy(&cap, &mut namespace);

        account::create_and_share(&mut namespace, ALICE);

        namespace.share_for_testing();
        sui::transfer::public_transfer(policy_cap, ADMIN);
        scenario.return_to_sender(cap);
        ts::return_shared(state);
    };

    // 2. Admin grants mint permission to MINTER
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // 3. MINTER mints into ALICE's PAS Account
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let alice_account = scenario.take_shared_by_id<Account>(alice_account_id);

        state.mint_to_account(
            &mut registry,
            &deny_list,
            &alice_account,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(alice_account);
    };

    // 4. Admin tries clawback without blacklisting -> fails with ENotBlacklisted
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let deny_list = scenario.take_shared<DenyList>();
        let namespace = scenario.take_shared<Namespace>();
        let policy = scenario.take_shared<Policy<sui::balance::Balance<CNGN_PAS>>>();

        let alice_account_id = namespace.account_address(ALICE).to_id();
        let mut alice_account = scenario.take_shared_by_id<Account>(alice_account_id);

        state.destroy_black_funds(
            &cap,
            &policy,
            &mut alice_account,
            &deny_list,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
        ts::return_shared(namespace);
        ts::return_shared(policy);
        ts::return_shared(alice_account);
    };

    scenario.end();
}
