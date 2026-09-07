// SPDX-License-Identifier: MIT

#[test_only]
module cngn::cngn_tests;

use cngn::admin::{Self, AdminCap, AdminRegistry};
use cngn::cngn::{Self, CNGN, CoinState};
use std::unit_test::assert_eq;
use sui::balance;
use sui::coin::{Self, Coin};
use sui::deny_list::{Self, DenyList};
use sui::test_scenario::{Self as ts, Scenario};

use fun cngn::is_black_listed as DenyList.is_black_listed;

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
        cngn::init_for_testing(scenario.ctx());
    };
    scenario
}

// ==========================================
// 1. Admin Registry & Permissions Tests
// ==========================================

#[test]
fun admin_init_defaults() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let registry = scenario.take_shared<AdminRegistry>();
        assert!(!registry.can_mint(ADMIN));
        assert_eq!(registry.mint_amount(ADMIN), 0);
        assert_eq!(registry.version(), 1);
        ts::return_shared(registry);
    };

    scenario.end();
}

#[test]
fun admin_minter_stepwise_and_revocation() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();

        // Step 1: Add minter
        registry.add_can_mint(&cap, MINTER);
        assert!(registry.can_mint(MINTER));

        // Step 2: Set mint amount
        registry.add_mint_amount(&cap, MINTER, MINT_AMOUNT);
        assert_eq!(registry.mint_amount(MINTER), MINT_AMOUNT);

        // Step 3: Remove mint amount
        registry.remove_mint_amount(&cap, MINTER);
        assert_eq!(registry.mint_amount(MINTER), 0);

        // Step 4: Remove minter authority
        registry.remove_can_mint_by_admin(&cap, MINTER);
        assert!(!registry.can_mint(MINTER));

        // Step 5: Test combined grant and revoke helpers
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        assert!(registry.can_mint(MINTER));
        assert_eq!(registry.mint_amount(MINTER), MINT_AMOUNT);

        registry.revoke_mint_permission(&cap, MINTER);
        assert!(!registry.can_mint(MINTER));
        assert_eq!(registry.mint_amount(MINTER), 0);

        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = admin::EAlreadyAuthorized)]
fun admin_add_minter_duplicate_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();

        registry.add_can_mint(&cap, MINTER);
        registry.add_can_mint(&cap, MINTER); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = admin::EAlreadyAuthorized)]
fun admin_grant_mint_permission_duplicate_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();

        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = admin::ENotAuthorized)]
fun admin_add_mint_amount_to_unauthorized_minter_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();

        registry.add_mint_amount(&cap, MINTER, MINT_AMOUNT); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = admin::EZeroAmount)]
fun admin_grant_mint_zero_amount_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();

        registry.grant_mint_permission(&cap, MINTER, 0); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.end();
}

// ==========================================
// 2. cNGN Token Minting, Supply & Splitting Tests
// ==========================================

#[test]
fun token_full_mint_and_supply_tracking() {
    let mut scenario = setup();

    // 1. Initial supply is 0
    scenario.next_tx(ADMIN);
    {
        let state = scenario.take_shared<CoinState>();
        assert_eq!(state.total_supply(), 0);
        assert_eq!(state.version(), 1);
        ts::return_shared(state);
    };

    // 2. Admin grants mint permission
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();

        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // 3. MINTER mints directly to ALICE
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            ALICE,
            scenario.ctx(),
        );

        // Grant is consumed
        assert!(!registry.can_mint(MINTER));
        assert_eq!(registry.mint_amount(MINTER), 0);
        assert_eq!(state.total_supply(), MINT_AMOUNT);

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    // 4. Verify ALICE received the exact amount
    scenario.next_tx(ALICE);
    {
        let coin = scenario.take_from_sender<Coin<CNGN>>();
        assert_eq!(coin.value(), MINT_AMOUNT);
        scenario.return_to_sender(coin);
    };

    scenario.end();
}

#[test]
fun token_mint_coin_composable() {
    let mut scenario = setup();

    // Admin grants mint permission to MINTER
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // MINTER mints composable Coin
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        let coin = state.mint_coin(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            scenario.ctx(),
        );

        assert_eq!(coin.value(), MINT_AMOUNT);
        assert_eq!(state.total_supply(), MINT_AMOUNT);

        state.burn_by_user(coin, scenario.ctx());
        assert_eq!(state.total_supply(), 0);

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::EBlacklisted)]
fun token_mint_fails_if_minter_is_blacklisted() {
    let mut scenario = setup();

    // 1. Admin grants mint permission to MINTER
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // 2. Admin adds MINTER to DenyList
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        state.add_black_list(&cap, &mut deny_list, MINTER, scenario.ctx());

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    // 3. Blacklisted minter attempts to mint -> Fails with EBlacklisted
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            ALICE,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::ERecipientBlacklisted)]
fun token_mint_fails_if_recipient_is_blacklisted() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

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

    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            ALICE, // Blacklisted recipient -> Fails
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::EZeroAddress)]
fun token_mint_to_zero_address_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            @0x0, // Zero address -> Fails
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::ENotAuthorizedToMint)]
fun token_cannot_mint_twice_with_single_grant() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // First mint succeeds
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            ALICE,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    // Second mint fails because grant was consumed
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            ALICE,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::EAmountMismatch)]
fun token_mint_fails_on_amount_mismatch() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT + 1,
            ALICE,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::EZeroAmount)]
fun token_mint_zero_amount_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.add_can_mint(&cap, MINTER);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            0,
            ALICE,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

// ==========================================
// 3. Token Redemption & Burning Tests
// ==========================================

#[test]
fun token_partial_and_full_self_burn() {
    let mut scenario = setup();

    // Admin grants mint permission to MINTER
    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        registry.grant_mint_permission(&cap, MINTER, MINT_AMOUNT);
        scenario.return_to_sender(cap);
        ts::return_shared(registry);
    };

    // MINTER mints to ALICE
    scenario.next_tx(MINTER);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let deny_list = scenario.take_shared<DenyList>();

        state.mint(
            &mut registry,
            &deny_list,
            MINT_AMOUNT,
            ALICE,
            scenario.ctx(),
        );

        ts::return_shared(state);
        ts::return_shared(registry);
        ts::return_shared(deny_list);
    };

    // ALICE burns half of her coins
    scenario.next_tx(ALICE);
    {
        let mut state = scenario.take_shared<CoinState>();
        let mut coin = scenario.take_from_sender<Coin<CNGN>>();

        let burn_coin = coin.split(HALF_MINT_AMOUNT, scenario.ctx());
        state.burn_by_user(burn_coin, scenario.ctx());

        assert_eq!(state.total_supply(), HALF_MINT_AMOUNT);
        assert_eq!(coin.value(), HALF_MINT_AMOUNT);

        // ALICE burns the remaining half
        state.burn_by_user(coin, scenario.ctx());
        assert_eq!(state.total_supply(), 0);

        ts::return_shared(state);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::EZeroAmount)]
fun token_burn_zero_balance_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let mut state = scenario.take_shared<CoinState>();
        let zero_bal = balance::zero<CNGN>();
        state.burn_balance(zero_bal, scenario.ctx());

        ts::return_shared(state);
    };

    scenario.end();
}

// ==========================================
// 4. Token Compliance & Pause Tests
// ==========================================

#[test]
fun token_pause_and_unpause() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        assert!(!cngn::is_paused(&deny_list));
        assert!(!cngn::is_paused_current_epoch(&deny_list, scenario.ctx()));

        state.pause(&cap, &mut deny_list, scenario.ctx());
        assert!(cngn::is_paused(&deny_list));

        state.unpause(&cap, &mut deny_list, scenario.ctx());
        assert!(!cngn::is_paused(&deny_list));

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::EAlreadyPaused)]
fun token_pause_duplicate_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        state.pause(&cap, &mut deny_list, scenario.ctx());
        state.pause(&cap, &mut deny_list, scenario.ctx()); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::ENotPaused)]
fun token_unpause_when_not_paused_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        state.unpause(&cap, &mut deny_list, scenario.ctx()); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test]
fun token_blacklist_management() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        assert!(!deny_list.is_black_listed(BOB));

        state.add_black_list(&cap, &mut deny_list, BOB, scenario.ctx());
        assert!(deny_list.is_black_listed(BOB));

        state.remove_black_list(&cap, &mut deny_list, BOB, scenario.ctx());
        assert!(!deny_list.is_black_listed(BOB));

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::EAlreadyBlacklisted)]
fun token_add_blacklist_duplicate_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        state.add_black_list(&cap, &mut deny_list, BOB, scenario.ctx());
        state.add_black_list(&cap, &mut deny_list, BOB, scenario.ctx()); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = cngn::ENotBlacklisted)]
fun token_remove_unlisted_fails() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut state = scenario.take_shared<CoinState>();
        let mut deny_list = scenario.take_shared<DenyList>();

        state.remove_black_list(&cap, &mut deny_list, BOB, scenario.ctx()); // Fails

        scenario.return_to_sender(cap);
        ts::return_shared(state);
        ts::return_shared(deny_list);
    };

    scenario.end();
}

// ==========================================
// 5. Versioning & Migration Tests
// ==========================================

#[test]
fun token_versioning_and_migration() {
    let mut scenario = setup();

    scenario.next_tx(ADMIN);
    {
        let cap = scenario.take_from_sender<AdminCap>();
        let mut registry = scenario.take_shared<AdminRegistry>();
        let mut state = scenario.take_shared<CoinState>();

        assert_eq!(registry.version(), 1);
        assert_eq!(state.version(), 1);

        // Re-migrating to same version succeeds as a no-op / idempotent
        registry.migrate(&cap);
        state.migrate(&cap);

        assert_eq!(registry.version(), 1);
        assert_eq!(state.version(), 1);

        scenario.return_to_sender(cap);
        ts::return_shared(registry);
        ts::return_shared(state);
    };

    scenario.end();
}
