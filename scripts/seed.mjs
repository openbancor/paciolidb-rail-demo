// Seed: charts core + rail (ficticio, inspirado en payglobal).
import { command } from "./client.mjs";

const CORE = "payglobal-core";
const RAIL = "payglobal-railman";

const soft = async (p, what) => {
  const rc = await p;
  const st = rc["receipt/status"];
  if (st !== "accepted" && !(rc.reasons || []).some((r) => String(r["reason/code"] || "").includes("conflict")))
    throw new Error(`${what} rechazado: ${JSON.stringify(rc).slice(0, 200)}`);
  return rc;
};

for (const lid of [CORE, RAIL])
  await soft(command("ledger/declare", `declare-${lid}`,
    { "ledger/id": lid, "ledger/reporting-commodity": "MXN" }), `declare ${lid}`);

for (const lid of [CORE, RAIL])
  await soft(command("party/register", `party-${lid}-CLI-1`,
    { "ledger/id": lid, "party/code": "CLI-1",
      "party/name": "Cliente Uno", "party/type": "customer" }), `party ${lid}`);

const accts = [
  [CORE, "1100", "Core MXN settlement cash", "asset", "debit"],
  [CORE, "1101", "Core USD settlement cash", "asset", "debit"],
  [CORE, "1210", "Customer available balance", "liability", "credit"],
  [CORE, "1220", "Customer held balance", "liability", "credit"],
  [CORE, "1230", "Customer consumed balance", "liability", "credit"],
  [CORE, "4100", "FX revenue", "revenue", "credit"],
  [CORE, "4110", "Payment fee revenue", "revenue", "credit"],
  [CORE, "5100", "FX cost", "expense", "debit"],
  [CORE, "5200", "FX loss", "expense", "debit"],
  [CORE, "1200", "Customer return receivables", "asset", "debit"],
  [RAIL, "1200", "Core receivable", "asset", "debit"],
  [RAIL, "1300", "Provider cash", "asset", "debit"],
  [RAIL, "1310", "Provider clearing", "asset", "debit"],
  [RAIL, "2100", "Core payable", "liability", "credit"],
  [RAIL, "5200", "Return fee expense", "expense", "debit"],
];
for (const [lid, code, name, type, side] of accts)
  await soft(command("account/open", `acct-${lid}-${code}`,
    { "ledger/id": lid, "account/code": code, "account/name": name,
      "account/type": type, "account/normal-balance": side }), `cuenta ${lid}/${code}`);

console.log(`seed OK: 2 ledgers, ${accts.length} cuentas`);
