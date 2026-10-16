import { CantonClient, TEMPLATE_IDS } from "./client.js";
import type {
  AdminStatePayload,
  AllowancePayload,
  CantonContract,
  CNGNTokenPayload,
  ForwardRequestPayload,
  ForwarderRegistryPayload,
  MintProposalPayload,
  MintRegistryPayload,
  NonceTrackerPayload,
  TrustedContractRegistryPayload,
} from "./types.js";

export interface CreateMintProposalParams {
  issuer: string;
  minter: string;
  mintTo: string;
  amount: number | string;
  proposalId: string;
  paused?: boolean;
}

export interface TransferParams {
  contractId: string;
  to: string;
  amount: number | string;
}

export interface BurnParams {
  contractId: string;
  amount: number | string;
}

export interface CreateAllowanceParams {
  tokenOwner: string;
  spender: string;
  amount: number | string;
}

export interface CreateForwardRequestParams {
  from: string;
  relayer: string;
  to: string;
  nonce: number | string;
  mintProposalCid: string;
  complianceCid: string;
  forwarderCid: string;
  mintCid: string;
  nonceTrackerCid: string;
}

export class CNGNService {
  constructor(private readonly client: CantonClient) {}

  // ═════════════════════════════════════════════════════════════════
  // 1. TOKEN HOLDINGS (CNGNToken) & BALANCES
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query active cNGN token holdings.
   * If owner is provided, filters for contracts belonging to that party.
   */
  async getTokens(owner?: string): Promise<CantonContract<CNGNTokenPayload>[]> {
    const filter = owner ? { owner } : undefined;
    return this.client.query<CNGNTokenPayload>(TEMPLATE_IDS.token, filter);
  }

  /**
   * Sum the active holdings for an owner to determine total balance.
   * Returns balance in atomic units (6 decimals) and human-readable units.
   */
  async getBalance(owner: string): Promise<{ raw: bigint; formatted: string }> {
    const tokens = await this.getTokens(owner);
    const total = tokens.reduce((acc, t) => {
      return acc + BigInt(t.payload.amount);
    }, 0n);

    // 6 decimals: 1_000_000 raw = 1.000000 cNGN
    const integerPart = total / 1_000_000n;
    const fractionalPart = (total % 1_000_000n).toString().padStart(6, "0");

    return {
      raw: total,
      formatted: `${integerPart}.${fractionalPart}`,
    };
  }

  /**
   * Transfer cNGN tokens to another party (Transfer choice).
   * Consumes contractId; creates a new holding for `to` and returns change if partial.
   */
  async transfer(params: TransferParams) {
    return this.client.exercise(
      TEMPLATE_IDS.token,
      params.contractId,
      "Transfer",
      {
        to: params.to,
        transferAmt: params.amount.toString(),
      },
    );
  }

  /**
   * Burn cNGN tokens by holder (BurnByUser choice).
   * Consumes contractId; refunds remainder if partial.
   */
  async burn(params: BurnParams) {
    return this.client.exercise(
      TEMPLATE_IDS.token,
      params.contractId,
      "BurnByUser",
      {
        burnAmt: params.amount.toString(),
      },
    );
  }

  /**
   * Pause a specific token holding (Pause choice, issuer only).
   */
  async pauseToken(contractId: string) {
    return this.client.exercise(TEMPLATE_IDS.token, contractId, "Pause", {});
  }

  /**
   * Unpause a specific token holding (UnPause choice, issuer only).
   */
  async unpauseToken(contractId: string) {
    return this.client.exercise(TEMPLATE_IDS.token, contractId, "UnPause", {});
  }

  /**
   * Consolidate fragmented holdings of the same owner and issuer into one primary holding (Merge choice).
   */
  async mergeHoldings(primaryCid: string, otherCids: string[]) {
    return this.client.exercise(TEMPLATE_IDS.token, primaryCid, "Merge", {
      otherCids,
    });
  }

  /**
   * Reject an unwanted token holding (RejectToken choice).
   */
  async rejectToken(contractId: string) {
    return this.client.exercise(TEMPLATE_IDS.token, contractId, "RejectToken", {});
  }

  // ═════════════════════════════════════════════════════════════════
  // 2. MINT PROPOSAL LIFECYCLE (MintProposal)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query active mint proposals.
   */
  async getMintProposals(filter?: {
    issuer?: string;
    minter?: string;
    proposalId?: string;
  }): Promise<CantonContract<MintProposalPayload>[]> {
    return this.client.query<MintProposalPayload>(TEMPLATE_IDS.mintProposal, filter);
  }

  /**
   * Pre-authorize a mint proposal (Issuer action).
   */
  async createMintProposal(params: CreateMintProposalParams) {
    return this.client.create<MintProposalPayload>(TEMPLATE_IDS.mintProposal, {
      issuer: params.issuer,
      minter: params.minter,
      mintTo: params.mintTo,
      amount: params.amount.toString(),
      paused: params.paused ?? false,
      proposalId: params.proposalId,
    });
  }

  /**
   * Execute an authorized mint proposal (ExecuteMint choice, Minter action).
   * Mints CNGNToken holding for mintTo.
   */
  async executeMint(proposalContractId: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintProposal,
      proposalContractId,
      "ExecuteMint",
      {},
    );
  }

  /**
   * Cancel an existing mint proposal (CancelMint choice, Issuer action).
   */
  async cancelMint(proposalContractId: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintProposal,
      proposalContractId,
      "CancelMint",
      {},
    );
  }

  /**
   * Lift a proposal-level pause (UnpauseMint choice, Issuer action).
   */
  async unpauseMint(proposalContractId: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintProposal,
      proposalContractId,
      "UnpauseMint",
      {},
    );
  }

  /**
   * Reject an unsolicited mint proposal (RejectMint choice, Minter action).
   */
  async rejectMint(proposalContractId: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintProposal,
      proposalContractId,
      "RejectMint",
      {},
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 3. ALLOWANCES (Allowance)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query active allowances.
   */
  async getAllowances(filter?: {
    tokenOwner?: string;
    spender?: string;
  }): Promise<CantonContract<AllowancePayload>[]> {
    return this.client.query<AllowancePayload>(TEMPLATE_IDS.allowance, filter);
  }

  /**
   * Create an allowance granting spender authority to spend tokens.
   */
  async createAllowance(params: CreateAllowanceParams) {
    return this.client.create<AllowancePayload>(TEMPLATE_IDS.allowance, {
      tokenOwner: params.tokenOwner,
      spender: params.spender,
      amount: params.amount.toString(),
    });
  }

  /**
   * Spend tokens from an allowance (SpendAllowance choice, Spender action).
   */
  async spendAllowance(allowanceCid: string, spendAmt: number | string) {
    return this.client.exercise(TEMPLATE_IDS.allowance, allowanceCid, "SpendAllowance", {
      spendAmt: spendAmt.toString(),
    });
  }

  /**
   * Increase an existing allowance (IncreaseAllowance choice, Token owner action).
   */
  async increaseAllowance(allowanceCid: string, addedValue: number | string) {
    return this.client.exercise(
      TEMPLATE_IDS.allowance,
      allowanceCid,
      "IncreaseAllowance",
      {
        addedValue: addedValue.toString(),
      },
    );
  }

  /**
   * Decrease an existing allowance (DecreaseAllowance choice, Token owner action).
   */
  async decreaseAllowance(allowanceCid: string, subtractedValue: number | string) {
    return this.client.exercise(
      TEMPLATE_IDS.allowance,
      allowanceCid,
      "DecreaseAllowance",
      {
        subtractedValue: subtractedValue.toString(),
      },
    );
  }

  /**
   * Revoke an allowance entirely (RevokeAllowance choice, Token owner action).
   */
  async revokeAllowance(allowanceCid: string) {
    return this.client.exercise(TEMPLATE_IDS.allowance, allowanceCid, "RevokeAllowance", {});
  }

  /**
   * Reject an unwanted allowance (RejectAllowance choice, Spender action).
   */
  async rejectAllowance(allowanceCid: string) {
    return this.client.exercise(TEMPLATE_IDS.allowance, allowanceCid, "RejectAllowance", {});
  }

  // ═════════════════════════════════════════════════════════════════
  // 4. ADMIN & COMPLIANCE (AdminState)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query the AdminState contract for a specific issuer/owner.
   */
  async getAdminState(owner?: string): Promise<CantonContract<AdminStatePayload>[]> {
    const filter = owner ? { owner } : undefined;
    return this.client.query<AdminStatePayload>(TEMPLATE_IDS.adminState, filter);
  }

  /**
   * Emergency global pause: halts transfers, mints, and burns platform-wide (PauseAll choice).
   */
  async pauseAll(adminStateCid: string) {
    return this.client.exercise(TEMPLATE_IDS.adminState, adminStateCid, "PauseAll", {});
  }

  /**
   * Lift global emergency pause (UnpauseAll choice).
   */
  async unpauseAll(adminStateCid: string) {
    return this.client.exercise(TEMPLATE_IDS.adminState, adminStateCid, "UnpauseAll", {});
  }

  /**
   * Add a party to the compliance blacklist (AddBlackList choice).
   * Automatically cascades into mint, forwarder, and trusted contract registries.
   */
  async addBlacklist(adminStateCid: string, user: string) {
    return this.client.exercise(TEMPLATE_IDS.adminState, adminStateCid, "AddBlackList", {
      user,
    });
  }

  /**
   * Remove a party from the compliance blacklist (RemoveBlackList choice).
   */
  async removeBlacklist(adminStateCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.adminState,
      adminStateCid,
      "RemoveBlackList",
      {
        user,
      },
    );
  }

  /**
   * Check if a party is blacklisted (IsBlackListed nonconsuming choice).
   */
  async isBlacklisted(adminStateCid: string, user: string): Promise<boolean> {
    const res = await this.client.exercise<boolean>(
      TEMPLATE_IDS.adminState,
      adminStateCid,
      "IsBlackListed",
      { user },
    );
    return res.exerciseResult;
  }

  // ═════════════════════════════════════════════════════════════════
  // 5. MINT REGISTRY & AUTHORIZATION (MintRegistry)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query the MintRegistry for an issuer.
   */
  async getMintRegistry(owner?: string): Promise<CantonContract<MintRegistryPayload>[]> {
    const filter = owner ? { owner } : undefined;
    return this.client.query<MintRegistryPayload>(TEMPLATE_IDS.mintRegistry, filter);
  }

  /**
   * Authorize a party to be a minter (AddCanMint choice).
   */
  async addCanMint(mintRegistryCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintRegistry,
      mintRegistryCid,
      "AddCanMint",
      { user },
    );
  }

  /**
   * Remove a party from authorized minters (RemoveCanMint choice).
   */
  async removeCanMint(mintRegistryCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintRegistry,
      mintRegistryCid,
      "RemoveCanMint",
      { user },
    );
  }

  /**
   * Clear a minter idempotently (ClearMinter choice).
   */
  async clearMinter(mintRegistryCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintRegistry,
      mintRegistryCid,
      "ClearMinter",
      { user },
    );
  }

  /**
   * Add a specific single-use mint grant for a proposal (AddMintGrant choice).
   */
  async addMintGrant(
    mintRegistryCid: string,
    user: string,
    proposalId: string,
    amount: number | string,
  ) {
    return this.client.exercise(
      TEMPLATE_IDS.mintRegistry,
      mintRegistryCid,
      "AddMintGrant",
      {
        user,
        proposalId,
        amount: amount.toString(),
      },
    );
  }

  /**
   * Remove a mint grant for a minter (RemoveMintGrant choice).
   */
  async removeMintGrant(mintRegistryCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.mintRegistry,
      mintRegistryCid,
      "RemoveMintGrant",
      { user },
    );
  }

  /**
   * Check if a party can mint (CanMintQuery nonconsuming choice).
   */
  async canMintQuery(mintRegistryCid: string, user: string): Promise<boolean> {
    const res = await this.client.exercise<boolean>(
      TEMPLATE_IDS.mintRegistry,
      mintRegistryCid,
      "CanMintQuery",
      { user },
    );
    return res.exerciseResult;
  }

  /**
   * Get the authorized mint amount for a minter (GetMintAmount nonconsuming choice).
   */
  async getMintAmount(mintRegistryCid: string, user: string): Promise<bigint> {
    const res = await this.client.exercise<string | number>(
      TEMPLATE_IDS.mintRegistry,
      mintRegistryCid,
      "GetMintAmount",
      { user },
    );
    return BigInt(res.exerciseResult);
  }

  // ═════════════════════════════════════════════════════════════════
  // 6. FORWARDER REGISTRY (ForwarderRegistry)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query the ForwarderRegistry for an issuer.
   */
  async getForwarderRegistry(owner?: string): Promise<CantonContract<ForwarderRegistryPayload>[]> {
    const filter = owner ? { owner } : undefined;
    return this.client.query<ForwarderRegistryPayload>(TEMPLATE_IDS.forwarderRegistry, filter);
  }

  /**
   * Authorize a relayer to forward requests (AddCanForward choice).
   */
  async addCanForward(forwarderRegistryCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.forwarderRegistry,
      forwarderRegistryCid,
      "AddCanForward",
      { user },
    );
  }

  /**
   * Remove an authorized forwarder (RemoveCanForward choice).
   */
  async removeCanForward(forwarderRegistryCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.forwarderRegistry,
      forwarderRegistryCid,
      "RemoveCanForward",
      { user },
    );
  }

  /**
   * Clear a forwarder idempotently (ClearForwarder choice).
   */
  async clearForwarder(forwarderRegistryCid: string, user: string) {
    return this.client.exercise(
      TEMPLATE_IDS.forwarderRegistry,
      forwarderRegistryCid,
      "ClearForwarder",
      { user },
    );
  }

  /**
   * Check if a party is authorized to forward (CanForwardQuery nonconsuming choice).
   */
  async canForwardQuery(forwarderRegistryCid: string, user: string): Promise<boolean> {
    const res = await this.client.exercise<boolean>(
      TEMPLATE_IDS.forwarderRegistry,
      forwarderRegistryCid,
      "CanForwardQuery",
      { user },
    );
    return res.exerciseResult;
  }

  // ═════════════════════════════════════════════════════════════════
  // 7. TRUSTED CONTRACT REGISTRY (TrustedContractRegistry)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query the TrustedContractRegistry for an issuer.
   */
  async getTrustedContractRegistry(
    owner?: string,
  ): Promise<CantonContract<TrustedContractRegistryPayload>[]> {
    const filter = owner ? { owner } : undefined;
    return this.client.query<TrustedContractRegistryPayload>(
      TEMPLATE_IDS.trustedContractRegistry,
      filter,
    );
  }

  /**
   * Add a trusted counterparty/contract (AddTrustedContract choice).
   */
  async addTrustedContract(trustedRegistryCid: string, contractParty: string) {
    return this.client.exercise(
      TEMPLATE_IDS.trustedContractRegistry,
      trustedRegistryCid,
      "AddTrustedContract",
      { contract: contractParty },
    );
  }

  /**
   * Remove a trusted counterparty/contract (RemoveTrustedContract choice).
   */
  async removeTrustedContract(trustedRegistryCid: string, contractParty: string) {
    return this.client.exercise(
      TEMPLATE_IDS.trustedContractRegistry,
      trustedRegistryCid,
      "RemoveTrustedContract",
      { contract: contractParty },
    );
  }

  /**
   * Clear a trusted counterparty idempotently (ClearTrustedContract choice).
   */
  async clearTrustedContract(trustedRegistryCid: string, contractParty: string) {
    return this.client.exercise(
      TEMPLATE_IDS.trustedContractRegistry,
      trustedRegistryCid,
      "ClearTrustedContract",
      { contract: contractParty },
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 8. NONCE TRACKER & META-TRANSACTIONS (Forwarder & NonceTracker)
  // ═════════════════════════════════════════════════════════════════

  /**
   * Query the NonceTracker for a minter.
   */
  async getNonceTrackers(owner?: string): Promise<CantonContract<NonceTrackerPayload>[]> {
    const filter = owner ? { owner } : undefined;
    return this.client.query<NonceTrackerPayload>(TEMPLATE_IDS.nonceTracker, filter);
  }

  /**
   * Get the current numeric nonce for a minter.
   */
  async getNonce(owner: string): Promise<bigint | null> {
    const trackers = await this.getNonceTrackers(owner);
    if (!trackers.length) return null;
    return BigInt(trackers[0].payload.nonce);
  }

  /**
   * Advance the nonce tracker directly (IncrementNonce choice).
   */
  async incrementNonce(nonceTrackerCid: string) {
    return this.client.exercise(
      TEMPLATE_IDS.nonceTracker,
      nonceTrackerCid,
      "IncrementNonce",
      {},
    );
  }

  /**
   * Query active ForwardRequests.
   */
  async getForwardRequests(filter?: {
    from?: string;
    relayer?: string;
    to?: string;
  }): Promise<CantonContract<ForwardRequestPayload>[]> {
    return this.client.query<ForwardRequestPayload>(TEMPLATE_IDS.forwardRequest, filter);
  }

  /**
   * Create a new signed ForwardRequest (from and to co-sign).
   */
  async createForwardRequest(params: CreateForwardRequestParams) {
    return this.client.create<ForwardRequestPayload>(TEMPLATE_IDS.forwardRequest, {
      from: params.from,
      relayer: params.relayer,
      to: params.to,
      nonce: params.nonce.toString(),
      payload: {
        mintProposalCid: params.mintProposalCid,
      },
      complianceCid: params.complianceCid,
      forwarderCid: params.forwarderCid,
      mintCid: params.mintCid,
      nonceTrackerCid: params.nonceTrackerCid,
    });
  }

  /**
   * Execute an authorized ForwardRequest (Execute choice, Relayer action).
   */
  async executeForward(forwardRequestCid: string) {
    return this.client.exercise(
      TEMPLATE_IDS.forwardRequest,
      forwardRequestCid,
      "Execute",
      {},
    );
  }

  /**
   * Reject a ForwardRequest (RejectForward choice, Relayer action).
   */
  async rejectForward(forwardRequestCid: string) {
    return this.client.exercise(
      TEMPLATE_IDS.forwardRequest,
      forwardRequestCid,
      "RejectForward",
      {},
    );
  }
}
