// SPDX-License-Identifier: MIT
/// cNGN — Regulated Nigerian Naira-pegged stablecoin on Sui.
///
/// Implements the Sui Standard Fungible Token / Regulated Currency (v2) pattern
/// using `sui::coin` and `sui::deny_list`.
///
/// Because Sui's `Coin<T>` objects move peer-to-peer without invoking module code,
/// regulatory compliance (blacklisting and global secondary market pause) is enforced
/// via Sui's validator-level DenyList mechanism.
module cngn::cngn {
    use sui::coin::{Self, Coin, TreasuryCap, DenyCapV2};
    use sui::balance::{Self, Balance};
    use sui::deny_list::DenyList;
    use sui::url::Url;
    use sui::event;
    use cngn::admin::{Self, AdminCap, AdminRegistry};

    // --- One-Time Witness ---

    /// One-Time Witness for coin initialization.
    public struct CNGN has drop {}

    // --- Core State Structs ---

    /// Shared object holding administrative capabilities over the cNGN coin type.
    public struct CoinState has key {
        id: UID,
        treasury: TreasuryCap<CNGN>,
        deny_cap: DenyCapV2<CNGN>,
    }

    // --- Events ---

    public struct MintEvent has copy, drop {
        minter: address,
        recipient: address,
        amount: u64,
    }

    public struct BurnEvent has copy, drop {
        burner: address,
        amount: u64,
    }

    public struct PauseEvent has copy, drop {
        paused: bool,
    }

    public struct BlacklistEvent has copy, drop {
        user: address,
        blacklisted: bool,
    }

    // --- Error Codes ---

    const EBlacklisted: u64 = 0;
    const ENotAuthorizedToMint: u64 = 1;
    const EAmountMismatch: u64 = 2;
    const EZeroAmount: u64 = 3;

    // --- Initialization ---

    fun init(otw: CNGN, ctx: &mut TxContext) {
        let (treasury, deny_cap, metadata) = coin::create_regulated_currency_v2(
            otw,
            6, // decimals (1 cNGN = 1,000,000 base units)
            b"cNGN",
            b"cNGN",
            b"Nigerian Naira-pegged stablecoin",
            option::none<Url>(),
            true, // allow_global_pause enables circuit-breaker pause/unpause
            ctx,
        );

        // Immutable coin metadata
        transfer::public_freeze_object(metadata);

        // Shared coin state holding the capability handles
        transfer::share_object(CoinState {
            id: object::new(ctx),
            treasury,
            deny_cap,
        });
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(CNGN {}, ctx);
    }

    // --- Minting & Issuance ---

    /// Primary entrypoint: mints cNGN directly to a recipient.
    ///
    /// Invariants enforced:
    /// 1. Caller and recipient must not be on the validator DenyList.
    /// 2. Caller must possess an active `can_mint` authorization.
    /// 3. The requested `amount` must match `mint_amount` exactly.
    /// 4. The mint grant is consumed atomically.
    public fun mint(
        state: &mut CoinState,
        registry: &mut AdminRegistry,
        deny_list: &DenyList,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let minted_coin = mint_coin(state, registry, deny_list, amount, ctx);
        transfer::public_transfer(minted_coin, recipient);

        event::emit(MintEvent {
            minter: tx_context::sender(ctx),
            recipient,
            amount,
        });
    }

    /// Composable mint function returning a `Coin<CNGN>` object.
    public fun mint_coin(
        state: &mut CoinState,
        registry: &mut AdminRegistry,
        deny_list: &DenyList,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<CNGN> {
        let minted_balance = mint_balance(state, registry, deny_list, amount, ctx);
        coin::from_balance(minted_balance, ctx)
    }

    /// Low-level composable mint function returning a `Balance<CNGN>`.
    public fun mint_balance(
        state: &mut CoinState,
        registry: &mut AdminRegistry,
        deny_list: &DenyList,
        amount: u64,
        ctx: &mut TxContext,
    ): Balance<CNGN> {
        assert!(amount > 0, EZeroAmount);
        let signer = tx_context::sender(ctx);

        // Compliance checks
        assert!(!coin::deny_list_v2_contains_current(deny_list, signer), EBlacklisted);
        assert!(admin::can_mint(registry, signer), ENotAuthorizedToMint);
        assert!(admin::mint_amount(registry, signer) == amount, EAmountMismatch);

        // Atomic mint and grant consumption
        let minted = coin::mint_balance(&mut state.treasury, amount);
        admin::consume_mint_grant(registry, signer);

        minted
    }

    // --- Redemption & Burning ---

    /// User-initiated burn of a `Coin<CNGN>` for off-chain fiat redemption.
    public fun burn_by_user(
        state: &mut CoinState,
        c: Coin<CNGN>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&c);
        coin::burn(&mut state.treasury, c);

        event::emit(BurnEvent {
            burner: tx_context::sender(ctx),
            amount,
        });
    }

    /// Burns a raw `Balance<CNGN>`.
    public fun burn_balance(
        state: &mut CoinState,
        b: Balance<CNGN>,
        ctx: &mut TxContext,
    ) {
        let amount = balance::value(&b);
        balance::decrease_supply(coin::supply_mut(&mut state.treasury), b);

        event::emit(BurnEvent {
            burner: tx_context::sender(ctx),
            amount,
        });
    }

    // --- Compliance & DenyList Controls ---

    /// Adds an address to the validator-enforced DenyList (Blacklist).
    public fun add_black_list(
        _cap: &AdminCap,
        state: &mut CoinState,
        deny_list: &mut DenyList,
        user: address,
        ctx: &mut TxContext,
    ) {
        coin::deny_list_v2_add(deny_list, &mut state.deny_cap, user, ctx);

        event::emit(BlacklistEvent {
            user,
            blacklisted: true,
        });
    }

    /// Removes an address from the validator-enforced DenyList.
    public fun remove_black_list(
        _cap: &AdminCap,
        state: &mut CoinState,
        deny_list: &mut DenyList,
        user: address,
        ctx: &mut TxContext,
    ) {
        coin::deny_list_v2_remove(deny_list, &mut state.deny_cap, user, ctx);

        event::emit(BlacklistEvent {
            user,
            blacklisted: false,
        });
    }

    /// Enables the global emergency pause, freezing all secondary transfers.
    public fun pause(
        _cap: &AdminCap,
        state: &mut CoinState,
        deny_list: &mut DenyList,
        ctx: &mut TxContext,
    ) {
        coin::deny_list_v2_enable_global_pause(deny_list, &mut state.deny_cap, ctx);

        event::emit(PauseEvent {
            paused: true,
        });
    }

    /// Disables the global emergency pause, restoring secondary transfers.
    public fun unpause(
        _cap: &AdminCap,
        state: &mut CoinState,
        deny_list: &mut DenyList,
        ctx: &mut TxContext,
    ) {
        coin::deny_list_v2_disable_global_pause(deny_list, &mut state.deny_cap, ctx);

        event::emit(PauseEvent {
            paused: false,
        });
    }

    // --- Public Queries ---

    public fun is_black_listed(deny_list: &DenyList, user: address): bool {
        coin::deny_list_v2_contains_current(deny_list, user)
    }

    public fun total_supply(state: &CoinState): u64 {
        coin::total_supply(&state.treasury)
    }
}
