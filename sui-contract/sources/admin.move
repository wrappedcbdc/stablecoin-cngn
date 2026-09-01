// SPDX-License-Identifier: MIT

/// Admin & Access-Control Registry for cNGN on Sui.
///
/// Implements full parity with EVM `Operations.sol` (Admin contract), adhering
/// to modern Sui Move 2024 coding standards.
module cngn::admin;

use sui::event;
use sui::table::{Self, Table};

// --- Capabilities and Shared State ---

/// Held by the protocol administrator / governance multisig.
/// Required for all privileged administrative operations.
public struct AdminCap has key, store {
    id: UID,
}

/// Shared registry tracking minter authorizations, mint amounts,
/// forwarder whitelists, and trusted contracts.
public struct AdminRegistry has key {
    id: UID,
    can_mint: Table<address, bool>,
    mint_amount: Table<address, u64>,
    can_forward: Table<address, bool>,
    trusted_contract: Table<address, bool>,
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

public struct ForwarderWhitelisted has copy, drop {
    user: address,
}

public struct ForwarderBlacklisted has copy, drop {
    user: address,
}

public struct ContractWhitelisted has copy, drop {
    contract_address: address,
}

public struct ContractBlacklisted has copy, drop {
    contract_address: address,
}

// --- Error Constants (EPascalCase) ---

const EAlreadyAuthorized: u64 = 0;
const ENotAuthorized: u64 = 1;
const EZeroAmount: u64 = 2;
const EForwarderAlreadyAdded: u64 = 3;
const ENotAForwarder: u64 = 4;
const EContractAlreadyAdded: u64 = 5;
const EContractDoesNotExist: u64 = 6;

// --- Initialization ---

fun init(ctx: &mut TxContext) {
    let sender = ctx.sender();
    let admin_cap = AdminCap { id: object::new(ctx) };

    let mut can_forward = table::new(ctx);
    let mut can_mint = table::new(ctx);
    let mint_amount = table::new(ctx);
    let trusted_contract = table::new(ctx);

    // Deployer default privileges
    can_forward.add(sender, true);
    can_mint.add(sender, true);

    let registry = AdminRegistry {
        id: object::new(ctx),
        can_mint,
        mint_amount,
        can_forward,
        trusted_contract,
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
    assert!(registry.can_mint.get_bool(user), ENotAuthorized);
    registry.can_mint.set_bool(user, false);
    registry.mint_amount.set_u64(user, 0);

    event::emit(MinterBlacklisted { user });
}

/// Sets exact mint amount allowed for an authorized minter.
public fun add_mint_amount(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
    amount: u64,
) {
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
    registry.mint_amount.set_u64(user, 0);

    event::emit(MintAmountRemoved { user });
}

/// Authorizes a minter with an exact amount in a single call.
public fun grant_mint_permission(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
    amount: u64,
) {
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
    registry.can_mint.set_bool(user, false);
    registry.mint_amount.set_u64(user, 0);

    event::emit(MinterBlacklisted { user });
    event::emit(MintAmountRemoved { user });
}

/// Single-use grant consumption.
/// Called automatically and atomically by `cngn::cngn::mint` upon a successful mint.
public(package) fun consume_mint_grant(
    registry: &mut AdminRegistry,
    user: address,
) {
    assert!(registry.can_mint.get_bool(user), ENotAuthorized);
    registry.can_mint.set_bool(user, false);
    registry.mint_amount.set_u64(user, 0);

    event::emit(MinterBlacklisted { user });
    event::emit(MintAmountRemoved { user });
}

// ==========================================
// Forwarder Management (canForward)
// ==========================================

/// Whitelists a meta-transaction forwarder / relayer.
public fun add_can_forward(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
) {
    assert!(!registry.can_forward.get_bool(user), EForwarderAlreadyAdded);
    registry.can_forward.set_bool(user, true);

    event::emit(ForwarderWhitelisted { user });
}

/// Removes a forwarder from whitelist.
public fun remove_can_forward(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    user: address,
) {
    assert!(registry.can_forward.get_bool(user), ENotAForwarder);
    registry.can_forward.set_bool(user, false);

    event::emit(ForwarderBlacklisted { user });
}

// ==========================================
// Trusted Contract Management (trustedContract)
// ==========================================

/// Whitelists an external trusted contract address.
public fun add_trusted_contract(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    contract_address: address,
) {
    assert!(!registry.trusted_contract.get_bool(contract_address), EContractAlreadyAdded);
    registry.trusted_contract.set_bool(contract_address, true);

    event::emit(ContractWhitelisted { contract_address });
}

/// Removes contract from trusted list.
public fun remove_trusted_contract(
    registry: &mut AdminRegistry,
    _cap: &AdminCap,
    contract_address: address,
) {
    assert!(registry.trusted_contract.get_bool(contract_address), EContractDoesNotExist);
    registry.trusted_contract.set_bool(contract_address, false);

    event::emit(ContractBlacklisted { contract_address });
}

// ==========================================
// Read Queries
// ==========================================

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

public fun can_forward(registry: &AdminRegistry, user: address): bool {
    registry.can_forward.get_bool(user)
}

public fun is_trusted_contract(registry: &AdminRegistry, contract_address: address): bool {
    registry.trusted_contract.get_bool(contract_address)
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
