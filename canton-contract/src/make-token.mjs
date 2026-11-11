import { createHmac } from "node:crypto";

const parties = process.argv.slice(2);
if (parties.length === 0) throw new Error("usage: node make-token.mjs <party> [<party> ...]");

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header = { alg: "HS256", typ: "JWT" };
const payload = {
  "https://daml.com/ledger-api": {
    ledgerId: "sandbox",
    applicationId: "cngn-dev",
    actAs: parties,
    readAs: parties,
  },
};

const data = `${b64(header)}.${b64(payload)}`;
const sig = createHmac("sha256", "secret").update(data).digest("base64url");
console.log(`${data}.${sig}`);