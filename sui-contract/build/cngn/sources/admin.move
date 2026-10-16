// SPDX-License-Identifier: MIT

/// Admin & Access-Control Registry for cNGN on Sui.
///
/// Implements full parity with EVM `Operations.sol` (Admin contract), adhering
/// to modern Sui Move 2024 coding standards.
module cngn::admin;

use sui::event;
use sui::table::{Self, Table};

use fun get_bool as Table.get_bool;
use fun set_bool as Table.set_bool;
use fun set_u64 as Table.set_u64;

// --- Package Version ---

const CURRENT_VERSION: u64 = 1;

// --- Capabilities and Shared State ---

/// Held by the protocol administrator / governance multisig.
/// Required for all privileged administrative operations.
public struct AdminCap has key, store {
    id: UID,
}

/// Shared registry tracking minter authorizations and mint amounts.
public struct AdminRegistry has key {
    id: UID,
    version: u64,
    can_mint: Table<address, bool>,
    mint_amount: Table<address, u64>,
}

// --- Events (Named in Past Tense) ---

public struct MinterWhitelisted has copy, drop {
    user: address,
}

public struct MinterBlacklisted has copy, drop {
    user: address,
}

public struct MintAmountAdded has copy, drop {
    user: address,
    amount: u64,
}

public struct MintAmountRemoved has copy, drop {
    user: address,
}

public struct MintGrantConsumed has copy, drop {
    user: address,
    amount: u64,
}

// --- Error Constants (EPascalCase) ---

const EAlreadyAuthorized: u64 = 0;
const ENotAuthorized: u64 = 1;
const EZeroAmount: u64 = 2;
const EWrongVersion: u64 = 3;

// --- Initialization ---

fun init(ctx: &mut TxContext) {
    let sender = ctx.sender();
    let admin_cap = AdminCap { id: object::new(ctx) };

    let can_mint = table::new(ctx);
    let mint_amount = table::new(ctx);

    let registry = AdminRegistry {
        id: object::new(ctx),
        version: CURRENT_VERSION,
        can_mint,
        mint_amount,
    };

    transfer::transfer(admin_cap, sender);
    transfer::share_object(registry);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

// ==========================================
// Minter Authorization (canMint & mintAmount)
// ==========================================

/// Authorizes an address to mint (Object goes first, Cap goes second).
public fun add_can_mint(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
) {
    assert!(registry.version == CURRENT_VERSION, EWrongVersion);
    assert!(!registry.can_mint.get_bool(user), EAlreadyAuthorized);
    registry.can_mint.set_bool(user, true);

    event::emit(MinterWhitelisted { user });
}

/// Revokes minting authority from an address.
public fun remove_can_mint_by_admin(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
) {
    assert!(registry.version == CURRENT_VERSION, EWrongVersion);
    assert!(registry.can_mint.get_bool(user), ENotAuthorized);

    if (registry.can_mint.contains(user)) {
        registry.can_mint.remove(user);
    };
    if (registry.mint_amount.contains(user)) {
        registry.mint_amount.remove(user);
    };

    event::emit(MinterBlacklisted { user });
}

/// Sets exact mint amount allowed for an authorized minter.
public fun add_mint_amount(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
    amount: u64,
) {
    assert!(registry.version == CURRENT_VERSION, EWrongVersion);
    assert!(registry.can_mint.get_bool(user), ENotAuthorized);
    assert!(amount > 0, EZeroAmount);
    registry.mint_amount.set_u64(user, amount);

    event::emit(MintAmountAdded { user, amount });
}

/// Clears authorized mint amount.
public fun remove_mint_amount(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
) {
    assert!(registry.version == CURRENT_VERSION, EWrongVersion);
    if (registry.mint_amount.contains(user)) {
        registry.mint_amount.remove(user);
    };

    event::emit(MintAmountRemoved { user });
}

/// Authorizes a minter with an exact amount in a single call.
public fun grant_mint_permission(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
    amount: u64,
) {
    assert!(registry.version == CURRENT_VERSION, EWrongVersion);
    assert!(!registry.can_mint.get_bool(user), EAlreadyAuthorized);
    assert!(amount > 0, EZeroAmount);
    registry.can_mint.set_bool(user, true);
    registry.mint_amount.set_u64(user, amount);

    event::emit(MinterWhitelisted { user });
    event::emit(MintAmountAdded { user, amount });
}

/// Revokes authorization and clears amount in a single call.
public fun revoke_mint_permission(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
) {
    assert!(registry.version == CURRENT_VERSION, EWrongVersion);

    if (registry.can_mint.contains(user)) {
        registry.can_mint.remove(user);
    };
    if (registry.mint_amount.contains(user)) {
        registry.mint_amount.remove(user);
    };

    event::emit(MinterBlacklisted { user });
    event::emit(MintAmountRemoved { user });
}

/// Single-use grant consumption.
/// Called automatically and atomically by `cngn::cngn::mint` upon a successful mint.
public(package) fun consume_mint_grant(
    registry: &mut AdminRegistry,
    user: address,
) {
    assert!(registry.version == CURRENT_VERSION, EWrongVersion);
    assert!(registry.can_mint.get_bool(user), ENotAuthorized);

    let amount = if (registry.mint_amount.contains(user)) {
        registry.mint_amount.remove(user)
    } else {
        0u64
    };

    if (registry.can_mint.contains(user)) {
        registry.can_mint.remove(user);
    };

    event::emit(MintGrantConsumed { user, amount });
}

// ==========================================
// Version Migration
// ==========================================

public fun migrate(registry: &mut AdminRegistry, _cap: &AdminCap) {
    assert!(registry.version <= CURRENT_VERSION, EWrongVersion);
    registry.version = CURRENT_VERSION;
}

// ==========================================
// Read Queries
// ==========================================

public fun version(registry: &AdminRegistry): u64 {
    registry.version
}

public fun can_mint(registry: &AdminRegistry, user: address): bool {
    registry.can_mint.get_bool(user)
}

public fun mint_amount(registry: &AdminRegistry, user: address): u64 {
    if (registry.mint_amount.contains(user)) {
        registry.mint_amount[user]
    } else {
        0
    }
}

// ==========================================
// Internal Table Helpers
// ==========================================

fun get_bool(t: &Table<address, bool>, key: address): bool {
    if (t.contains(key)) {
        t[key]
    } else {
        false
    }
}

fun set_bool(t: &mut Table<address, bool>, key: address, value: bool) {
    if (t.contains(key)) {
        *t.borrow_mut(key) = value;
    } else {
        t.add(key, value);
    }
}

fun set_u64(t: &mut Table<address, u64>, key: address, value: u64) {
    if (t.contains(key)) {
        *t.borrow_mut(key) = value;
    } else {
        t.add(key, value);
    }
}
