import "dotenv/config";
import { CantonClient, TEMPLATE_IDS, PACKAGE_ID } from "./src/client.js";
import { CNGNService } from "./src/cngn-service.js";

export * from "./src/types.js";
export * from "./src/client.js";
export * from "./src/cngn-service.js";

/**
 * Convenience factory to create a fully initialized CNGNService
 * using the CANTON_JWT and CANTON_JSON_API from environment variables.
 */
export function createCNGNService(token?: string, apiUrl?: string): CNGNService {
  const jwt = token ?? process.env.CANTON_JWT ?? process.env.CANTON_ACCESS_TOKEN;
  if (!jwt) {
    throw new Error(
      "CANTON_JWT or CANTON_ACCESS_TOKEN must be set in environment or passed to createCNGNService()",
    );
  }

  const client = new CantonClient(jwt, apiUrl);
  return new CNGNService(client);
}

// Default export
export default createCNGNService;