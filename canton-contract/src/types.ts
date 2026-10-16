/**
 * Canton JSON API types and cNGN Daml template payload interfaces.
 */

export interface CantonContract<T = Record<string, unknown>> {
  contractId: string;
  templateId: string;
  key?: unknown;
  payload: T;
  signatories: string[];
  observers: string[];
  agreementText?: string;
}

export interface CantonApiResponse<T> {
  result: T;
  status: number;
  warnings?: unknown[];
  errors?: string[];
}

// ── Token Holding (UTXO) ──────────────────────────────────────────

export interface CNGNTokenPayload {
  issuer: string;
  owner: string;
  amount: string; // Daml Int serialized as string or number
  paused: boolean;
}

// ── Mint Proposal ─────────────────────────────────────────────────

export interface MintProposalPayload {
  issuer: string;
  minter: string;
  mintTo: string;
  amount: string;
  paused: boolean;
  proposalId: string;
}

// ── Allowance (Approve / TransferFrom) ─────────────────────────────

export interface AllowancePayload {
  tokenOwner: string;
  spender: string;
  amount: string;
}

// ── Admin Compliance State ────────────────────────────────────────

export interface AdminStatePayload {
  owner: string;
  blackListed: string[];
  globalPaused: boolean;
}

// ── Mint Registry ─────────────────────────────────────────────────

export interface MintGrant {
  minter: string;
  proposalId: string;
  amount: string;
}

export interface MintRegistryPayload {
  owner: string;
  canMint: string[];
  mintGrants: [string, string, string][]; // (minter, proposalId, amount) tuple
}

// ── Forwarder Registry ────────────────────────────────────────────

export interface ForwarderRegistryPayload {
  owner: string;
  canForward: string[];
}

// ── Trusted Contract Registry ─────────────────────────────────────

export interface TrustedContractRegistryPayload {
  owner: string;
  trustedContracts: string[];
}

// ── Nonce Tracker ─────────────────────────────────────────────────

export interface NonceTrackerPayload {
  owner: string;
  nonce: string;
}

// ── Forward Request ───────────────────────────────────────────────

export interface ForwardPayload {
  mintProposalCid: string;
}

export interface ForwardRequestPayload {
  from: string;
  relayer: string;
  to: string;
  nonce: string;
  payload: ForwardPayload;
  complianceCid: string;
  forwarderCid: string;
  mintCid: string;
  nonceTrackerCid: string;
}
