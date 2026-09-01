// SPDX-License-Identifier: MIT

/// cNGN — Regulated Nigerian Naira-pegged stablecoin on Sui.
///
/// Implements the Sui Standard Fungible Token / Regulated Currency (v2) pattern
/// using `sui::coin` and `sui::deny_list`, following the Move 2024 Code Quality Checklist.
module cngn::cngn;

use cngn::admin::{Self, AdminCap, AdminRegistry};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin, DenyCapV2, TreasuryCap};
use sui::deny_list::DenyList;
use sui::event;
use sui::url::Url;

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

// --- Events (Named in Past Tense) ---

public struct Minted has copy, drop {
    minter: address,
    recipient: address,
    amount: u64,
}

public struct Burned has copy, drop {
    burner: address,
    amount: u64,
}

public struct Paused has copy, drop {
    paused: bool,
}

public struct BlacklistUpdated has copy, drop {
    user: address,
    blacklisted: bool,
}

// --- Error Constants (EPascalCase) ---

const EBlacklisted: u64 = 0;
const ENotAuthorizedToMint: u64 = 1;
const EAmountMismatch: u64 = 2;
const EZeroAmount: u64 = 3;

// --- Initialization ---

fun init(otw: CNGN, ctx: &mut TxContext) {
    let (treasury, deny_cap, metadata) = coin::create_regulated_currency_v2(
        otw,
        6, // decimals (1 cNGN = 1,000,000 base atomic units)
        b"cNGN",
        b"cNGN",
        b"Nigerian Naira-pegged stablecoin",
        option::none<Url>(),
        true, // allow_global_pause enables circuit-breaker pause/unpause
        ctx,
    );

    // Immutable coin metadata
    transfer::public_freeze_object(metadata);

    // Shared coin state holding capability handles
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
    let minted_coin = state.mint_coin(registry, deny_list, amount, ctx);
    transfer::public_transfer(minted_coin, recipient);

    event::emit(Minted {
        minter: ctx.sender(),
        recipient,
        amount,
    });
}

/// Composable mint function returning a `Coin<CNGN>` object for PTBs.
public fun mint_coin(
    state: &mut CoinState,
    registry: &mut AdminRegistry,
    deny_list: &DenyList,
    amount: u64,
    ctx: &mut TxContext,
): Coin<CNGN> {
    let minted_balance = state.mint_balance(registry, deny_list, amount, ctx);
    minted_balance.into_coin(ctx)
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
    let signer = ctx.sender();

    // Compliance checks
    assert!(!coin::deny_list_v2_contains_current(deny_list, signer), EBlacklisted);
    assert!(registry.can_mint(signer), ENotAuthorizedToMint);
    assert!(registry.mint_amount(signer) == amount, EAmountMismatch);

    // Atomic mint and grant consumption
    let minted = state.treasury.mint_balance(amount);
    registry.consume_mint_grant(signer);

    minted
}

// --- Redemption & Burning ---

/// User-initiated burn of a `Coin<CNGN>` for off-chain fiat redemption.
public fun burn_by_user(
    state: &mut CoinState,
    c: Coin<CNGN>,
    ctx: &mut TxContext,
) {
    let amount = c.value();
    state.treasury.burn(c);

    event::emit(Burned {
        burner: ctx.sender(),
        amount,
    });
}

/// Burns a raw `Balance<CNGN>`.
public fun burn_balance(
    state: &mut CoinState,
    b: Balance<CNGN>,
    ctx: &mut TxContext,
) {
    let amount = b.value();
    balance::decrease_supply(state.treasury.supply_mut(), b);

    event::emit(Burned {
        burner: ctx.sender(),
        amount,
    });
}

// --- Compliance & DenyList Controls ---

/// Adds an address to the validator-enforced DenyList (Blacklist).
/// Object goes first, Capability goes second.
public fun add_black_list(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    user: address,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_add(deny_list, &mut state.deny_cap, user, ctx);

    event::emit(BlacklistUpdated {
        user,
        blacklisted: true,
    });
}

/// Removes an address from the validator-enforced DenyList.
/// Object goes first, Capability goes second.
public fun remove_black_list(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    user: address,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_remove(deny_list, &mut state.deny_cap, user, ctx);

    event::emit(BlacklistUpdated {
        user,
        blacklisted: false,
    });
}

/// Enables the global emergency pause, freezing all secondary transfers.
/// Object goes first, Capability goes second.
public fun pause(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_enable_global_pause(deny_list, &mut state.deny_cap, ctx);

    event::emit(Paused {
        paused: true,
    });
}

/// Disables the global emergency pause, restoring secondary transfers.
/// Object goes first, Capability goes second.
public fun unpause(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_disable_global_pause(deny_list, &mut state.deny_cap, ctx);

    event::emit(Paused {
        paused: false,
    });
}

// --- Public Queries ---

public fun is_black_listed(deny_list: &DenyList, user: address): bool {
    coin::deny_list_v2_contains_current(deny_list, user)
}

public fun total_supply(state: &CoinState): u64 {
    state.treasury.total_supply()
}
