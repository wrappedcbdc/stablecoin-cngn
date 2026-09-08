// SPDX-License-Identifier: MIT

/// cNGN — Regulated Nigerian Naira-pegged stablecoin on Sui.
///
/// Implements the Sui Standard Fungible Token / Regulated Currency (v2) pattern
/// using `sui::coin` and `sui::deny_list`, following the Move 2024 Code Quality Checklist.
module cngn::cngn;

use cngn::admin::{Self, AdminCap, AdminRegistry};
use std::ascii;
use std::string;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin, CoinMetadata, DenyCapV2, TreasuryCap};
use sui::deny_list::DenyList;
use sui::event;
use sui::url::{Self, Url};

// --- Package Version ---

const CURRENT_VERSION: u64 = 1;

// --- One-Time Witness ---

/// One-Time Witness for coin initialization.
public struct CNGN has drop {}

// --- Core State Structs ---

/// Shared object holding administrative capabilities over the cNGN coin type.
public struct CoinState has key {
    id: UID,
    version: u64,
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

public struct MetadataUpdated has copy, drop {
    field: std::ascii::String,
    new_value: std::ascii::String,
}

// --- Error Constants (EPascalCase) ---

const EBlacklisted: u64 = 0;
const ENotAuthorizedToMint: u64 = 1;
const EAmountMismatch: u64 = 2;
const EZeroAmount: u64 = 3;
const EZeroAddress: u64 = 4;
const ERecipientBlacklisted: u64 = 5;
const EWrongVersion: u64 = 6;
const EAlreadyBlacklisted: u64 = 7;
const ENotBlacklisted: u64 = 8;
const EAlreadyPaused: u64 = 9;
const ENotPaused: u64 = 10;

// --- Initialization ---

#[allow(deprecated_usage)]
fun init(otw: CNGN, ctx: &mut TxContext) {
    let icon_url = option::some(
        url::new_unsafe_from_bytes(
            b"https://aqua-changing-meadowlark-684.mypinata.cloud/ipfs/bafkreifug3lermi2qlcrtyimh5oqd4hmhebi76tevyat3hyul5u32qvb3a"
        )
    );

    let (treasury, deny_cap, metadata) = coin::create_regulated_currency_v2(
        otw,
        6, // decimals (1 cNGN = 1,000,000 base atomic units)
        b"cNGN",
        b"cNGN",
        b"cNGN is Nigeria's first regulated stablecoin, pegged 1:1 to the Nigerian Naira and fully backed by naira reserves held in licensed commercial banks.",
        icon_url,
        true, // allow_global_pause enables circuit-breaker pause/unpause
        ctx,
    );

    // Shared coin metadata so it remains accessible to explorers and updatable by Admin
    transfer::public_share_object(metadata);

    // Shared coin state holding capability handles
    transfer::share_object(CoinState {
        id: object::new(ctx),
        version: CURRENT_VERSION,
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
/// 2. Recipient must not be @0x0.
/// 3. Caller must possess an active `can_mint` authorization.
/// 4. The requested `amount` must match `mint_amount` exactly.
/// 5. The mint grant is consumed atomically.
public fun mint(
    state: &mut CoinState,
    registry: &mut AdminRegistry,
    deny_list: &DenyList,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(recipient != @0x0, EZeroAddress);
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN>(deny_list, recipient), ERecipientBlacklisted);

    let minted_balance = state.mint_balance(registry, deny_list, amount, ctx);
    let minted_coin = minted_balance.into_coin(ctx);
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
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let minter = ctx.sender();
    let minted_balance = state.mint_balance(registry, deny_list, amount, ctx);

    event::emit(Minted {
        minter,
        recipient: minter,
        amount,
    });

    minted_balance.into_coin(ctx)
}

/// Low-level package-internal mint function returning a `Balance<CNGN>`.
public(package) fun mint_balance(
    state: &mut CoinState,
    registry: &mut AdminRegistry,
    deny_list: &DenyList,
    amount: u64,
    ctx: &TxContext,
): Balance<CNGN> {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(amount > 0, EZeroAmount);
    let signer = ctx.sender();

    // Compliance checks
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN>(deny_list, signer), EBlacklisted);
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
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let amount = c.value();
    assert!(amount > 0, EZeroAmount);
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
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let amount = b.value();
    assert!(amount > 0, EZeroAmount);
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
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN>(deny_list, user), EAlreadyBlacklisted);
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
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(coin::deny_list_v2_contains_next_epoch<CNGN>(deny_list, user), ENotBlacklisted);
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
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(!coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN>(deny_list), EAlreadyPaused);
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
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN>(deny_list), ENotPaused);
    coin::deny_list_v2_disable_global_pause(deny_list, &mut state.deny_cap, ctx);

    event::emit(Paused {
        paused: false,
    });
}

// --- Metadata Management ---

/// Allows Admin to update the coin logo URL.
public entry fun update_icon_url(
    state: &mut CoinState,
    _admin: &AdminCap,
    metadata: &mut CoinMetadata<CNGN>,
    new_url: vector<u8>,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let url_ascii = ascii::string(new_url);
    coin::update_icon_url(&state.treasury, metadata, url_ascii);
    event::emit(MetadataUpdated {
        field: ascii::string(b"icon_url"),
        new_value: url_ascii,
    });
}

/// Allows Admin to update the coin description.
public entry fun update_description(
    state: &mut CoinState,
    _admin: &AdminCap,
    metadata: &mut CoinMetadata<CNGN>,
    new_description: vector<u8>,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let desc_str = string::utf8(new_description);
    coin::update_description(&state.treasury, metadata, desc_str);
    event::emit(MetadataUpdated {
        field: ascii::string(b"description"),
        new_value: ascii::string(new_description),
    });
}

/// Allows Admin to update the coin display name.
public entry fun update_name(
    state: &mut CoinState,
    _admin: &AdminCap,
    metadata: &mut CoinMetadata<CNGN>,
    new_name: vector<u8>,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let name_str = string::utf8(new_name);
    coin::update_name(&state.treasury, metadata, name_str);
    event::emit(MetadataUpdated {
        field: ascii::string(b"name"),
        new_value: ascii::string(new_name),
    });
}

/// Allows Admin to update the coin symbol.
public entry fun update_symbol(
    state: &mut CoinState,
    _admin: &AdminCap,
    metadata: &mut CoinMetadata<CNGN>,
    new_symbol: vector<u8>,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let symbol_ascii = ascii::string(new_symbol);
    coin::update_symbol(&state.treasury, metadata, symbol_ascii);
    event::emit(MetadataUpdated {
        field: ascii::string(b"symbol"),
        new_value: symbol_ascii,
    });
}

// --- Version Migration ---

public fun migrate(state: &mut CoinState, _cap: &AdminCap) {
    assert!(state.version <= CURRENT_VERSION, EWrongVersion);
    state.version = CURRENT_VERSION;
}

// --- Public Queries ---

public fun version(state: &CoinState): u64 {
    state.version
}

public fun is_black_listed(deny_list: &DenyList, user: address): bool {
    coin::deny_list_v2_contains_next_epoch<CNGN>(deny_list, user)
}

public fun is_paused(deny_list: &DenyList): bool {
    coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN>(deny_list)
}

public fun is_paused_current_epoch(deny_list: &DenyList, ctx: &TxContext): bool {
    coin::deny_list_v2_is_global_pause_enabled_current_epoch<CNGN>(deny_list, ctx)
}

public fun total_supply(state: &CoinState): u64 {
    state.treasury.total_supply()
}
