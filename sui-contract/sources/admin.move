// SPDX-License-Identifier: MIT
/// Admin & Access-Control Registry for cNGN on Sui.
///
/// Implements full parity with EVM `Operations.sol` (Admin contract), including:
/// - Minter authorizations (`canMint`) and per-minter exact caps (`mintAmount`)
/// - Whitelisted forwarders / relayers (`canForward`)
/// - Whitelisted / trusted external contracts (`trustedContract`)
/// - Event parity for indexing and off-chain listeners
/// - Package-level and capability-gated privilege models
module cngn::admin {
    use sui::table::{Self, Table};
    use sui::event;

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

    // --- Events (1:1 parity with EVM Operations.sol) ---

    public struct WhitelistedMinter has copy, drop {
        user: address,
    }

    public struct BlacklistedMinter has copy, drop {
        user: address,
    }

    public struct MintAmountAdded has copy, drop {
        user: address,
        amount: u64,
    }

    public struct MintAmountRemoved has copy, drop {
        user: address,
    }

    public struct WhitelistedForwarder has copy, drop {
        user: address,
    }

    public struct BlacklistedForwarder has copy, drop {
        user: address,
    }

    public struct WhitelistedContract has copy, drop {
        contract_address: address,
    }

    public struct BlacklistedContract has copy, drop {
        contract_address: address,
    }

    // --- Error Codes ---

    const EAlreadyAuthorized: u64 = 0;
    const ENotAuthorized: u64 = 1;
    const EZeroAmount: u64 = 2;
    const EForwarderAlreadyAdded: u64 = 3;
    const ENotAForwarder: u64 = 4;
    const EContractAlreadyAdded: u64 = 5;
    const EContractDoesNotExist: u64 = 6;

    // --- Initialization ---

    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let admin_cap = AdminCap { id: object::new(ctx) };
        
        let mut can_forward = table::new(ctx);
        let mut can_mint = table::new(ctx);
        let mint_amount = table::new(ctx);
        let trusted_contract = table::new(ctx);

        // Mirror EVM initialize(): deployer canForward and canMint are true by default
        table::add(&mut can_forward, sender, true);
        table::add(&mut can_mint, sender, true);

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

    /// Mirrors `Operations.AddCanMint`. Authorizes an address to mint.
    public fun add_can_mint(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
    ) {
        assert!(!table_get_bool(&registry.can_mint, user), EAlreadyAuthorized);
        set_bool(&mut registry.can_mint, user, true);

        event::emit(WhitelistedMinter { user });
    }

    /// Mirrors `Operations.RemoveCanMint`. Revokes minting authority from an address.
    public fun remove_can_mint_by_admin(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
    ) {
        assert!(table_get_bool(&registry.can_mint, user), ENotAuthorized);
        set_bool(&mut registry.can_mint, user, false);
        set_u64(&mut registry.mint_amount, user, 0);

        event::emit(BlacklistedMinter { user });
    }

    /// Mirrors `Operations.AddMintAmount`. Sets exact mint amount allowed for an authorized minter.
    public fun add_mint_amount(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
        amount: u64,
    ) {
        assert!(table_get_bool(&registry.can_mint, user), ENotAuthorized);
        assert!(amount > 0, EZeroAmount);
        set_u64(&mut registry.mint_amount, user, amount);

        event::emit(MintAmountAdded { user, amount });
    }

    /// Mirrors `Operations.RemoveMintAmount`. Clears authorized mint amount.
    public fun remove_mint_amount(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
    ) {
        set_u64(&mut registry.mint_amount, user, 0);

        event::emit(MintAmountRemoved { user });
    }

    /// Convenience workflow: Authorizes a minter with an exact amount in a single call.
    public fun grant_mint_permission(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
        amount: u64,
    ) {
        assert!(amount > 0, EZeroAmount);
        set_bool(&mut registry.can_mint, user, true);
        set_u64(&mut registry.mint_amount, user, amount);

        event::emit(WhitelistedMinter { user });
        event::emit(MintAmountAdded { user, amount });
    }

    /// Revokes authorization and clears amount in a single call.
    public fun revoke_mint_permission(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
    ) {
        set_bool(&mut registry.can_mint, user, false);
        set_u64(&mut registry.mint_amount, user, 0);

        event::emit(BlacklistedMinter { user });
        event::emit(MintAmountRemoved { user });
    }

    /// Single-use grant consumption.
    /// Called automatically and atomically by `cngn::cngn::mint` upon a successful mint.
    public(package) fun consume_mint_grant(
        registry: &mut AdminRegistry,
        user: address,
    ) {
        assert!(table_get_bool(&registry.can_mint, user), ENotAuthorized);
        set_bool(&mut registry.can_mint, user, false);
        set_u64(&mut registry.mint_amount, user, 0);

        event::emit(BlacklistedMinter { user });
        event::emit(MintAmountRemoved { user });
    }

    // ==========================================
    // Forwarder Management (canForward)
    // ==========================================

    /// Mirrors `Operations.AddCanForward`. Whitelists a meta-transaction forwarder / relayer.
    public fun add_can_forward(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
    ) {
        assert!(!table_get_bool(&registry.can_forward, user), EForwarderAlreadyAdded);
        set_bool(&mut registry.can_forward, user, true);

        event::emit(WhitelistedForwarder { user });
    }

    /// Mirrors `Operations.RemoveCanForward`. Removes a forwarder from whitelist.
    public fun remove_can_forward(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        user: address,
    ) {
        assert!(table_get_bool(&registry.can_forward, user), ENotAForwarder);
        set_bool(&mut registry.can_forward, user, false);

        event::emit(BlacklistedForwarder { user });
    }

    // ==========================================
    // Trusted Contract Management (trustedContract)
    // ==========================================

    /// Mirrors `Operations.AddTrustedContract`. Whitelists an external trusted contract address.
    public fun add_trusted_contract(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        contract_address: address,
    ) {
        assert!(!table_get_bool(&registry.trusted_contract, contract_address), EContractAlreadyAdded);
        set_bool(&mut registry.trusted_contract, contract_address, true);

        event::emit(WhitelistedContract { contract_address });
    }

    /// Mirrors `Operations.RemoveTrustedContract`. Removes contract from trusted list.
    public fun remove_trusted_contract(
        _cap: &AdminCap,
        registry: &mut AdminRegistry,
        contract_address: address,
    ) {
        assert!(table_get_bool(&registry.trusted_contract, contract_address), EContractDoesNotExist);
        set_bool(&mut registry.trusted_contract, contract_address, false);

        event::emit(BlacklistedContract { contract_address });
    }

    // ==========================================
    // Read Queries (1:1 with EVM Operations views)
    // ==========================================

    public fun can_mint(registry: &AdminRegistry, user: address): bool {
        table_get_bool(&registry.can_mint, user)
    }

    public fun mint_amount(registry: &AdminRegistry, user: address): u64 {
        if (table::contains(&registry.mint_amount, user)) {
            *table::borrow(&registry.mint_amount, user)
        } else {
            0
        }
    }

    public fun can_forward(registry: &AdminRegistry, user: address): bool {
        table_get_bool(&registry.can_forward, user)
    }

    public fun is_trusted_contract(registry: &AdminRegistry, contract_address: address): bool {
        table_get_bool(&registry.trusted_contract, contract_address)
    }

    // ==========================================
    // Internal Table Helpers
    // ==========================================

    fun table_get_bool(t: &Table<address, bool>, key: address): bool {
        if (table::contains(t, key)) {
            *table::borrow(t, key)
        } else {
            false
        }
    }

    fun set_bool(t: &mut Table<address, bool>, key: address, value: bool) {
        if (table::contains(t, key)) {
            *table::borrow_mut(t, key) = value;
        } else {
            table::add(t, key, value);
        }
    }

    fun set_u64(t: &mut Table<address, u64>, key: address, value: u64) {
        if (table::contains(t, key)) {
            *table::borrow_mut(t, key) = value;
        } else {
            table::add(t, key, value);
        }
    }
}
