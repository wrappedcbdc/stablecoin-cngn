// SPDX-License-Identifier: MIT

/// cNGN Permissioned Asset Standard (PAS) Module
/// Pure PAS implementation of the cNGN stablecoin on Sui.
///
/// In this module:
/// - Balances are held strictly within PAS `Account` objects.
/// - Minting is only possible into PAS accounts (`mint_to_account`).
/// - Transfers occur exclusively between PAS accounts (`send_funds`).
/// - Burning is supported via administrative clawback (`destroy_black_funds`)
///   and compliant user self-burn (`burn_from_pas_account`).
module cngn::cngn_pas;

use cngn::admin::{Self, AdminCap, AdminRegistry};
use pas::account::{Self, Account};
use pas::clawback_funds::{Self, ClawbackFunds};
use pas::namespace::Namespace;
use pas::policy::{Self, Policy, PolicyCap};
use pas::request::Request;
use pas::send_funds::SendFunds;
use pas::unlock_funds::{Self, UnlockFunds};
use std::ascii;
use std::string;
use sui::balance::{Self, Balance};
use sui::coin::{Self, CoinMetadata, DenyCapV2, TreasuryCap};
use sui::deny_list::DenyList;
use sui::event;
use sui::url::{Self, Url};

// --- Package Version ---

const CURRENT_VERSION: u64 = 1;

// --- Structs & Events ---

/// One-Time Witness (OTW) for cNGN PAS currency.
public struct CNGN_PAS has drop {}

/// Shared on-chain state for cNGN PAS.
public struct CoinState has key {
    id: UID,
    version: u64,
    treasury: TreasuryCap<CNGN_PAS>,
    deny_cap: DenyCapV2<CNGN_PAS>,
}

// Events
public struct Minted has copy, drop {
    minter: address,
    recipient: address,
    amount: u64,
}

public struct Burned has copy, drop {
    burner: address,
    amount: u64,
}

public struct Blacklisted has copy, drop {
    user: address,
}

public struct Unblacklisted has copy, drop {
    user: address,
}

public struct Paused has copy, drop {}

public struct Unpaused has copy, drop {}

public struct MetadataUpdated has copy, drop {
    field: std::ascii::String,
    new_value: std::string::String,
}

public struct DestroyedBlackFunds has copy, drop {
    user: address,
    amount: u64,
}

/// Witness stamp for authorized regulatory clawbacks.
public struct ClawbackApproval() has drop;

/// Witness stamp for compliant PAS transfers.
public struct TransferApproval() has drop;

/// Witness stamp for authorized PAS unlocks and self-burns.
public struct UnlockApproval() has drop;

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
fun init(otw: CNGN_PAS, ctx: &mut TxContext) {
    let icon_url = option::some(
        url::new_unsafe_from_bytes(
            b"https://aqua-changing-meadowlark-684.mypinata.cloud/ipfs/bafkreifug3lermi2qlcrtyimh5oqd4hmhebi76tevyat3hyul5u32qvb3a"
        )
    );

    let (treasury, deny_cap, metadata) = coin::create_regulated_currency_v2(
        otw,
        6, // decimals (1 cNGN = 1,000,000 base atomic units)
        b"cNGN",
        b"cNGN (PAS)",
        b"cNGN is Nigeria's first regulated stablecoin, pegged 1:1 to the Nigerian Naira and fully backed by naira reserves. PAS-managed edition.",
        icon_url,
        true, // allow_global_pause enables circuit-breaker pause/unpause
        ctx,
    );

    // Shared coin metadata
    transfer::public_share_object(metadata);

    // Shared coin state
    transfer::share_object(CoinState {
        id: object::new(ctx),
        version: CURRENT_VERSION,
        treasury,
        deny_cap,
    });
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(CNGN_PAS {}, ctx);
}

// --- PAS Policy Configuration ---

/// Initializes the PAS Policy for cNGN_PAS with clawback and unlock enabled.
/// Callable by Admin holding `AdminCap`.
public fun setup_pas_policy(
    state: &mut CoinState,
    _cap: &AdminCap,
    namespace: &mut Namespace,
): PolicyCap<Balance<CNGN_PAS>> {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);

    // 1. Create policy with clawback_allowed = true
    let (mut policy, policy_cap) = policy::new_for_currency(
        namespace,
        &mut state.treasury,
        true, // clawback_allowed: true
    );

    // 2. Set required approval stamps
    policy.set_required_approval<_, TransferApproval>(
        &policy_cap,
        b"send_funds".to_string(),
    );
    policy.set_required_approval<_, ClawbackApproval>(
        &policy_cap,
        b"clawback_funds".to_string(),
    );
    policy.set_required_approval<_, UnlockApproval>(
        &policy_cap,
        b"unlock_funds".to_string(),
    );

    // 3. Share the policy object
    policy.share();

    policy_cap
}

// --- Compliance Approvals ---

/// Validates and approves a PAS transfer request for cNGN_PAS.
public fun approve_pas_transfer(
    deny_list: &DenyList,
    request: &mut Request<SendFunds<Balance<CNGN_PAS>>>,
) {
    assert!(!coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN_PAS>(deny_list), EAlreadyPaused);
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, request.data().recipient()), ERecipientBlacklisted);
    request.approve(TransferApproval());
}

/// Validates and approves an unlock request for cNGN_PAS.
public fun approve_pas_unlock(
    deny_list: &DenyList,
    request: &mut Request<UnlockFunds<Balance<CNGN_PAS>>>,
) {
    assert!(!coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN_PAS>(deny_list), EAlreadyPaused);
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, request.data().owner()), EBlacklisted);
    request.approve(UnlockApproval());
}

// --- Minting (Pure PAS into Account) ---

/// Package-internal balance minting with admin quota enforcement.
fun mint_balance(
    state: &mut CoinState,
    registry: &mut AdminRegistry,
    deny_list: &DenyList,
    amount: u64,
    ctx: &TxContext,
): Balance<CNGN_PAS> {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(amount > 0, EZeroAmount);
    let signer = ctx.sender();

    // Compliance checks
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, signer), EBlacklisted);
    assert!(registry.can_mint(signer), ENotAuthorizedToMint);
    assert!(registry.mint_amount(signer) == amount, EAmountMismatch);

    // Atomic mint and grant consumption
    let minted = state.treasury.mint_balance(amount);
    registry.consume_mint_grant(signer);

    minted
}

/// Mints cNGN_PAS tokens directly into a recipient's PAS Account.
public fun mint_to_account(
    state: &mut CoinState,
    registry: &mut AdminRegistry,
    deny_list: &DenyList,
    to_account: &Account,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let recipient = to_account.owner();
    assert!(recipient != @0x0, EZeroAddress);
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, recipient), ERecipientBlacklisted);

    let minted_balance = state.mint_balance(registry, deny_list, amount, ctx);
    to_account.deposit_balance(minted_balance);

    event::emit(Minted {
        minter: ctx.sender(),
        recipient,
        amount,
    });
}

// --- Burning (Pure PAS) ---

/// Allows a legitimate PAS account holder to burn cNGN_PAS directly from their account.
public fun burn_from_pas_account(
    state: &mut CoinState,
    deny_list: &DenyList,
    policy: &Policy<Balance<CNGN_PAS>>,
    account: &mut Account,
    auth: &account::Auth,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let burner = account.owner();
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, burner), EBlacklisted);
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, ctx.sender()), EBlacklisted);
    assert!(amount > 0, EZeroAmount);

    // 1. Initiate unlock request from caller's PAS account
    let mut request = account.unlock_balance<CNGN_PAS>(auth, amount, ctx);

    // 2. Attach UnlockApproval stamp
    request.approve(UnlockApproval());

    // 3. Resolve the balance from PAS
    let burned_balance = unlock_funds::resolve(request, policy);

    // 4. Burn from treasury supply
    balance::decrease_supply(state.treasury.supply_mut(), burned_balance);

    // 5. Emit Burned event
    event::emit(Burned {
        burner,
        amount,
    });
}

/// Admin claws back and burns cNGN_PAS from a blacklisted user's PAS account.
public fun destroy_black_funds(
    state: &mut CoinState,
    _admin: &AdminCap,
    policy: &Policy<Balance<CNGN_PAS>>,
    from_account: &mut Account,
    deny_list: &DenyList,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let target_user = from_account.owner();

    // 1. Enforce that target user is on the DenyList
    assert!(
        coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, target_user),
        ENotBlacklisted
    );
    assert!(amount > 0, EZeroAmount);

    // 2. Initiate clawback request from target user's shared Account
    let mut request = from_account.clawback_balance<CNGN_PAS>(amount, ctx);

    // 3. Admin stamps the request with ClawbackApproval
    request.approve(ClawbackApproval());

    // 4. Resolve the request against the PAS Policy, extracting the Balance<CNGN_PAS>
    let clawed_balance = clawback_funds::resolve(request, policy);

    // 5. Burn from treasury supply
    balance::decrease_supply(state.treasury.supply_mut(), clawed_balance);

    // 6. Emit event
    event::emit(DestroyedBlackFunds {
        user: target_user,
        amount,
    });
}

// --- Compliance & Admin Controls ---

public fun add_black_list(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    user: address,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(!coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, user), EAlreadyBlacklisted);
    coin::deny_list_v2_add<CNGN_PAS>(deny_list, &mut state.deny_cap, user, ctx);

    event::emit(Blacklisted { user });
}

public fun remove_black_list(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    user: address,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, user), ENotBlacklisted);
    coin::deny_list_v2_remove<CNGN_PAS>(deny_list, &mut state.deny_cap, user, ctx);

    event::emit(Unblacklisted { user });
}

public fun pause(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(!coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN_PAS>(deny_list), EAlreadyPaused);
    coin::deny_list_v2_enable_global_pause<CNGN_PAS>(deny_list, &mut state.deny_cap, ctx);

    event::emit(Paused {});
}

public fun unpause(
    state: &mut CoinState,
    _cap: &AdminCap,
    deny_list: &mut DenyList,
    ctx: &mut TxContext,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    assert!(coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN_PAS>(deny_list), ENotPaused);
    coin::deny_list_v2_disable_global_pause<CNGN_PAS>(deny_list, &mut state.deny_cap, ctx);

    event::emit(Unpaused {});
}

// --- Metadata Updates ---

public fun update_description(
    state: &mut CoinState,
    _admin: &AdminCap,
    metadata: &mut CoinMetadata<CNGN_PAS>,
    new_description: vector<u8>,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let desc_str = string::utf8(new_description);
    coin::update_description(&state.treasury, metadata, desc_str);
    event::emit(MetadataUpdated {
        field: ascii::string(b"description"),
        new_value: desc_str,
    });
}

public fun update_name(
    state: &mut CoinState,
    _admin: &AdminCap,
    metadata: &mut CoinMetadata<CNGN_PAS>,
    new_name: vector<u8>,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let name_str = string::utf8(new_name);
    coin::update_name(&state.treasury, metadata, name_str);
    event::emit(MetadataUpdated {
        field: ascii::string(b"name"),
        new_value: name_str,
    });
}

public fun update_symbol(
    state: &mut CoinState,
    _admin: &AdminCap,
    metadata: &mut CoinMetadata<CNGN_PAS>,
    new_symbol: vector<u8>,
) {
    assert!(state.version == CURRENT_VERSION, EWrongVersion);
    let ascii_sym = ascii::string(new_symbol);
    coin::update_symbol(&state.treasury, metadata, ascii_sym);
    event::emit(MetadataUpdated {
        field: ascii::string(b"symbol"),
        new_value: string::utf8(new_symbol),
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

public fun total_supply(state: &CoinState): u64 {
    coin::total_supply(&state.treasury)
}

public fun is_paused(deny_list: &DenyList): bool {
    coin::deny_list_v2_is_global_pause_enabled_next_epoch<CNGN_PAS>(deny_list)
}

public fun is_blacklisted(deny_list: &DenyList, user: address): bool {
    coin::deny_list_v2_contains_next_epoch<CNGN_PAS>(deny_list, user)
}
