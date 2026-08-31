// SPDX-License-Identifier: MIT
#[test_only]
module cngn::cngn_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::balance;
    use sui::deny_list::{Self, DenyList};
    use cngn::cngn::{Self, CNGN, CoinState};
    use cngn::admin::{Self, AdminCap, AdminRegistry};

    const ADMIN: address = @0xAD;
    const MINTER: address = @0xB0B;
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B2;
    const FORWARDER: address = @0xF08;
    const TRUSTED_CONTRACT: address = @0x789;
    const MINT_AMOUNT: u64 = 50_000_000_000; // 50,000 cNGN (6 decimals)
    const HALF_MINT_AMOUNT: u64 = 25_000_000_000;

    fun setup(): Scenario {
        let mut scenario = ts::begin(ADMIN);
        {
            deny_list::create_for_test(scenario.ctx());
            admin::init_for_testing(scenario.ctx());
            cngn::init_for_testing(scenario.ctx());
        };
        scenario
    }

    // ==========================================
    // 1. Admin Registry & Permissions Tests
    // ==========================================

    #[test]
    fun test_admin_init_defaults() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let registry = scenario.take_shared<AdminRegistry>();
            assert!(admin::can_mint(&registry, ADMIN), 0);
            assert!(admin::can_forward(&registry, ADMIN), 1);
            assert!(admin::mint_amount(&registry, ADMIN) == 0, 2);
            assert!(!admin::is_trusted_contract(&registry, ADMIN), 3);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    fun test_admin_forwarder_management() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            assert!(!admin::can_forward(&registry, FORWARDER), 0);
            admin::add_can_forward(&cap, &mut registry, FORWARDER);
            assert!(admin::can_forward(&registry, FORWARDER), 1);

            admin::remove_can_forward(&cap, &mut registry, FORWARDER);
            assert!(!admin::can_forward(&registry, FORWARDER), 2);

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 3, location = cngn::admin)] // EForwarderAlreadyAdded
    fun test_admin_add_forwarder_duplicate_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::add_can_forward(&cap, &mut registry, FORWARDER);
            admin::add_can_forward(&cap, &mut registry, FORWARDER); // Fails

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 4, location = cngn::admin)] // ENotAForwarder
    fun test_admin_remove_non_forwarder_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::remove_can_forward(&cap, &mut registry, FORWARDER); // Fails

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    fun test_admin_trusted_contract_management() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            assert!(!admin::is_trusted_contract(&registry, TRUSTED_CONTRACT), 0);
            admin::add_trusted_contract(&cap, &mut registry, TRUSTED_CONTRACT);
            assert!(admin::is_trusted_contract(&registry, TRUSTED_CONTRACT), 1);

            admin::remove_trusted_contract(&cap, &mut registry, TRUSTED_CONTRACT);
            assert!(!admin::is_trusted_contract(&registry, TRUSTED_CONTRACT), 2);

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 5, location = cngn::admin)] // EContractAlreadyAdded
    fun test_admin_add_trusted_contract_duplicate_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::add_trusted_contract(&cap, &mut registry, TRUSTED_CONTRACT);
            admin::add_trusted_contract(&cap, &mut registry, TRUSTED_CONTRACT); // Fails

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 6, location = cngn::admin)] // EContractDoesNotExist
    fun test_admin_remove_non_existent_trusted_contract_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::remove_trusted_contract(&cap, &mut registry, TRUSTED_CONTRACT); // Fails

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    fun test_admin_minter_stepwise_and_revocation() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            // Step 1: Add minter
            admin::add_can_mint(&cap, &mut registry, MINTER);
            assert!(admin::can_mint(&registry, MINTER), 0);

            // Step 2: Set mint amount
            admin::add_mint_amount(&cap, &mut registry, MINTER, MINT_AMOUNT);
            assert!(admin::mint_amount(&registry, MINTER) == MINT_AMOUNT, 1);

            // Step 3: Remove mint amount
            admin::remove_mint_amount(&cap, &mut registry, MINTER);
            assert!(admin::mint_amount(&registry, MINTER) == 0, 2);

            // Step 4: Remove minter authority
            admin::remove_can_mint_by_admin(&cap, &mut registry, MINTER);
            assert!(!admin::can_mint(&registry, MINTER), 3);

            // Step 5: Test combined grant and revoke helpers
            admin::grant_mint_permission(&cap, &mut registry, MINTER, MINT_AMOUNT);
            assert!(admin::can_mint(&registry, MINTER), 4);
            assert!(admin::mint_amount(&registry, MINTER) == MINT_AMOUNT, 5);

            admin::revoke_mint_permission(&cap, &mut registry, MINTER);
            assert!(!admin::can_mint(&registry, MINTER), 6);
            assert!(admin::mint_amount(&registry, MINTER) == 0, 7);

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 0, location = cngn::admin)] // EAlreadyAuthorized
    fun test_admin_add_minter_duplicate_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::add_can_mint(&cap, &mut registry, MINTER);
            admin::add_can_mint(&cap, &mut registry, MINTER); // Fails

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 1, location = cngn::admin)] // ENotAuthorized
    fun test_admin_add_mint_amount_to_unauthorized_minter_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::add_mint_amount(&cap, &mut registry, MINTER, MINT_AMOUNT); // Fails

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 2, location = cngn::admin)] // EZeroAmount
    fun test_admin_grant_mint_zero_amount_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::grant_mint_permission(&cap, &mut registry, MINTER, 0); // Fails

            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.end();
    }

    // ==========================================
    // 2. cNGN Token Minting, Supply & Splitting Tests
    // ==========================================

    #[test]
    fun test_token_full_mint_and_supply_tracking() {
        let mut scenario = setup();

        // 1. Initial supply is 0
        scenario.next_tx(ADMIN);
        {
            let state = scenario.take_shared<CoinState>();
            assert!(cngn::total_supply(&state) == 0, 0);
            ts::return_shared(state);
        };

        // 2. Admin grants mint permission
        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();

            admin::grant_mint_permission(&cap, &mut registry, MINTER, MINT_AMOUNT);
            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        // 3. Minter executes mint to ALICE
        scenario.next_tx(MINTER);
        {
            let mut state = scenario.take_shared<CoinState>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            let deny_list = scenario.take_shared<DenyList>();

            cngn::mint(
                &mut state,
                &mut registry,
                &deny_list,
                MINT_AMOUNT,
                ALICE,
                scenario.ctx(),
            );

            assert!(cngn::total_supply(&state) == MINT_AMOUNT, 1);
            assert!(!admin::can_mint(&registry, MINTER), 2);
            assert!(admin::mint_amount(&registry, MINTER) == 0, 3);

            ts::return_shared(state);
            ts::return_shared(registry);
            ts::return_shared(deny_list);
        };

        // 4. ALICE splits coin and transfers half to BOB
        scenario.next_tx(ALICE);
        {
            let mut coin_alice = scenario.take_from_sender<Coin<CNGN>>();
            assert!(coin::value(&coin_alice) == MINT_AMOUNT, 4);

            let coin_bob = coin::split(&mut coin_alice, HALF_MINT_AMOUNT, scenario.ctx());
            assert!(coin::value(&coin_alice) == HALF_MINT_AMOUNT, 5);
            assert!(coin::value(&coin_bob) == HALF_MINT_AMOUNT, 6);

            transfer::public_transfer(coin_bob, BOB);
            scenario.return_to_sender(coin_alice);
        };

        // 5. BOB joins coins and verifies balance
        scenario.next_tx(BOB);
        {
            let mut coin_bob = scenario.take_from_sender<Coin<CNGN>>();
            let coin_extra = coin::zero<CNGN>(scenario.ctx());
            coin::join(&mut coin_bob, coin_extra);
            assert!(coin::value(&coin_bob) == HALF_MINT_AMOUNT, 7);
            scenario.return_to_sender(coin_bob);
        };

        scenario.end();
    }

    #[test]
    fun test_token_mint_coin_and_mint_balance_composable() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            admin::grant_mint_permission(&cap, &mut registry, MINTER, MINT_AMOUNT);
            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.next_tx(MINTER);
        {
            let mut state = scenario.take_shared<CoinState>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            let deny_list = scenario.take_shared<DenyList>();

            let coin = cngn::mint_coin(
                &mut state,
                &mut registry,
                &deny_list,
                MINT_AMOUNT,
                scenario.ctx(),
            );

            assert!(coin::value(&coin) == MINT_AMOUNT, 0);
            assert!(cngn::total_supply(&state) == MINT_AMOUNT, 1);

            let balance = coin::into_balance(coin);
            assert!(balance::value(&balance) == MINT_AMOUNT, 2);

            cngn::burn_balance(&mut state, balance, scenario.ctx());
            assert!(cngn::total_supply(&state) == 0, 3);

            ts::return_shared(state);
            ts::return_shared(registry);
            ts::return_shared(deny_list);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 0, location = cngn::cngn)] // EBlacklisted
    fun test_token_mint_fails_if_minter_is_blacklisted() {
        let mut scenario = setup();

        // 1. Admin grants mint permission to MINTER
        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            admin::grant_mint_permission(&cap, &mut registry, MINTER, MINT_AMOUNT);
            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        // 2. Admin adds MINTER to DenyList
        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut state = scenario.take_shared<CoinState>();
            let mut deny_list = scenario.take_shared<DenyList>();

            cngn::add_black_list(&cap, &mut state, &mut deny_list, MINTER, scenario.ctx());

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

            cngn::mint(
                &mut state,
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

    #[test]
    #[expected_failure(abort_code = 1, location = cngn::cngn)] // ENotAuthorizedToMint
    fun test_token_cannot_mint_twice_with_single_grant() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            admin::grant_mint_permission(&cap, &mut registry, MINTER, MINT_AMOUNT);
            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        // First mint succeeds
        scenario.next_tx(MINTER);
        {
            let mut state = scenario.take_shared<CoinState>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            let deny_list = scenario.take_shared<DenyList>();

            cngn::mint(
                &mut state,
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

            cngn::mint(
                &mut state,
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

    #[test]
    #[expected_failure(abort_code = 2, location = cngn::cngn)] // EAmountMismatch
    fun test_token_mint_fails_on_amount_mismatch() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            admin::grant_mint_permission(&cap, &mut registry, MINTER, MINT_AMOUNT);
            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.next_tx(MINTER);
        {
            let mut state = scenario.take_shared<CoinState>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            let deny_list = scenario.take_shared<DenyList>();

            cngn::mint(
                &mut state,
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

    #[test]
    #[expected_failure(abort_code = 3, location = cngn::cngn)] // EZeroAmount
    fun test_token_mint_zero_amount_fails() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            admin::add_can_mint(&cap, &mut registry, MINTER);
            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.next_tx(MINTER);
        {
            let mut state = scenario.take_shared<CoinState>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            let deny_list = scenario.take_shared<DenyList>();

            cngn::mint(
                &mut state,
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
    // 3. cNGN Token Redemption & Burning Tests
    // ==========================================

    #[test]
    fun test_token_partial_and_full_self_burn() {
        let mut scenario = setup();

        // Mint MINT_AMOUNT to ALICE
        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            admin::grant_mint_permission(&cap, &mut registry, MINTER, MINT_AMOUNT);
            scenario.return_to_sender(cap);
            ts::return_shared(registry);
        };

        scenario.next_tx(MINTER);
        {
            let mut state = scenario.take_shared<CoinState>();
            let mut registry = scenario.take_shared<AdminRegistry>();
            let deny_list = scenario.take_shared<DenyList>();

            cngn::mint(
                &mut state,
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

            let burn_coin = coin::split(&mut coin, HALF_MINT_AMOUNT, scenario.ctx());
            cngn::burn_by_user(&mut state, burn_coin, scenario.ctx());

            assert!(cngn::total_supply(&state) == HALF_MINT_AMOUNT, 0);
            assert!(coin::value(&coin) == HALF_MINT_AMOUNT, 1);

            // ALICE burns the remaining half
            cngn::burn_by_user(&mut state, coin, scenario.ctx());
            assert!(cngn::total_supply(&state) == 0, 2);

            ts::return_shared(state);
        };

        scenario.end();
    }

    // ==========================================
    // 4. Token Compliance & Pause Tests
    // ==========================================

    #[test]
    fun test_token_pause_and_unpause() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut state = scenario.take_shared<CoinState>();
            let mut deny_list = scenario.take_shared<DenyList>();

            cngn::pause(&cap, &mut state, &mut deny_list, scenario.ctx());
            cngn::unpause(&cap, &mut state, &mut deny_list, scenario.ctx());

            scenario.return_to_sender(cap);
            ts::return_shared(state);
            ts::return_shared(deny_list);
        };

        scenario.end();
    }

    #[test]
    fun test_token_blacklist_management() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut state = scenario.take_shared<CoinState>();
            let mut deny_list = scenario.take_shared<DenyList>();

            assert!(!cngn::is_black_listed(&deny_list, BOB), 0);

            cngn::add_black_list(&cap, &mut state, &mut deny_list, BOB, scenario.ctx());
            assert!(cngn::is_black_listed(&deny_list, BOB), 1);

            cngn::remove_black_list(&cap, &mut state, &mut deny_list, BOB, scenario.ctx());
            assert!(!cngn::is_black_listed(&deny_list, BOB), 2);

            scenario.return_to_sender(cap);
            ts::return_shared(state);
            ts::return_shared(deny_list);
        };

        scenario.end();
    }
}
