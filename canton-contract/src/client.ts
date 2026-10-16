import "dotenv/config";
import type { CantonApiResponse, CantonContract } from "./types.js";

const DEFAULT_API_URL =
  process.env.CANTON_JSON_API ??
  process.env.CANTON_JSON_API_URL ??
  "http://102.209.46.187:7575";

export const PACKAGE_ID =
  process.env.CANTON_PACKAGE_ID ??
  "e576e21e686d8f1170ef90c8f24ce53712e5678723166a8fb8c19c0462c9a1bd";

export const TEMPLATE_IDS = {
  token: `${PACKAGE_ID}:CNGN:CNGNToken`,
  mintProposal: `${PACKAGE_ID}:CNGN:MintProposal`,
  allowance: `${PACKAGE_ID}:CNGN:Allowance`,
  adminState: `${PACKAGE_ID}:Admin:AdminState`,
  mintRegistry: `${PACKAGE_ID}:Admin:MintRegistry`,
  forwarderRegistry: `${PACKAGE_ID}:Admin:ForwarderRegistry`,
  trustedContractRegistry: `${PACKAGE_ID}:Admin:TrustedContractRegistry`,
  nonceTracker: `${PACKAGE_ID}:Forwarder:NonceTracker`,
  forwardRequest: `${PACKAGE_ID}:Forwarder:ForwardRequest`,
} as const;

export class CantonClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string = DEFAULT_API_URL,
  ) {}

  private async request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: CantonApiResponse<T>;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Canton API invalid JSON response (${response.status}): ${text}`);
    }

    if (!response.ok || (data.status !== undefined && data.status >= 400) || data.errors?.length) {
      const errMsgs = data.errors?.join(", ") ?? JSON.stringify(data);
      throw new Error(`Canton API error [${data.status ?? response.status}]: ${errMsgs}`);
    }

    return (data.result !== undefined ? data.result : data) as T;
  }

  /**
   * Query active contracts matching a given templateId and optional query filter.
   */
  async query<T = Record<string, unknown>>(
    templateId: string,
    queryFilter?: Record<string, unknown>,
  ): Promise<CantonContract<T>[]> {
    const payload: { templateIds: string[]; query?: Record<string, unknown> } = {
      templateIds: [templateId],
    };
    if (queryFilter) {
      payload.query = queryFilter;
    }

    return this.request<CantonContract<T>[]>("/v1/query", payload);
  }

  /**
   * Fetch an active contract by its contract key.
   */
  async fetchByKey<T = Record<string, unknown>>(
    templateId: string,
    key: unknown,
  ): Promise<CantonContract<T>> {
    return this.request<CantonContract<T>>("/v1/fetch", {
      templateId,
      key,
    });
  }

  /**
   * Create an instance of a template.
   */
  async create<T = Record<string, unknown>>(
    templateId: string,
    payload: Record<string, unknown>,
  ): Promise<CantonContract<T>> {
    return this.request<CantonContract<T>>("/v1/create", {
      templateId,
      payload,
    });
  }

  /**
   * Exercise a choice on an active contract by contractId.
   */
  async exercise<T = unknown>(
    templateId: string,
    contractId: string,
    choice: string,
    argument: Record<string, unknown> = {},
  ): Promise<{ exerciseResult: T; contracts: CantonContract[] }> {
    return this.request<{ exerciseResult: T; contracts: CantonContract[] }>("/v1/exercise", {
      templateId,
      contractId,
      choice,
      argument,
    });
  }

  /**
   * Exercise a choice on an active contract identified by key.
   */
  async exerciseByKey<T = unknown>(
    templateId: string,
    key: unknown,
    choice: string,
    argument: Record<string, unknown> = {},
  ): Promise<{ exerciseResult: T; contracts: CantonContract[] }> {
    return this.request<{ exerciseResult: T; contracts: CantonContract[] }>(
      "/v1/exerciseByKey",
      {
        templateId,
        key,
        choice,
        argument,
      },
    );
  }
}