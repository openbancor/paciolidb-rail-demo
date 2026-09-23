// Demo: día de un cliente ficticio en core + riel. Todo verificado.
import { command, query, ok } from "./client.mjs";

const CORE = "payglobal-core";
const RAIL = "payglobal-railman";
const D = "2026-09-23";
const entry = async (lid, id, desc, lines) =>
  ok(await command("entry/accept", id,
    { "ledger/id": lid, "posting/effective-date": D,
      "posting/description": desc, "posting/lines": lines }),
    desc);
const L = (acct, dr, cr, dim) => ({
  "line/account-code": acct, "line/debit": dr, "line/credit": cr,
  "line/commodity": "MXN", ...(dim ? { "line/dimensions": dim } : {}),
});
let fails = 0;
const check = (name, cond, extra = "") => {
  console.log(cond ? `  ✓ ${name}` : `  ✗ ${name} ${extra}`);
  if (!cond) fails++;
};

// 1. funding 1000 (Dr 1100 / Cr 1210)
await entry(CORE, "core-funding-1", "Funding CLI-1 1000",
  [L("1100", "1000.00", "0"), L("1210", "0", "1000.00")]);

// 2. pago 180 + fee 5 con hold: available→hold, fee→revenue; consume hold
await entry(CORE, "core-pay-hold-1", "Pago 180 + fee 5 (hold)",
  [L("1210", "185.00", "0"), L("1220", "0", "180.00"), L("4110", "0", "5.00")]);
await entry(CORE, "core-pay-consume-1", "Consumo hold 180",
  [L("1220", "180.00", "0"), L("1230", "0", "180.00")]);

// 3. riel pending→settled 100 (intent R-1)
const dim = { railIntentId: "R-1" };
await entry(RAIL, "rail-pending-R-1", "Railman pending R-1",
  [L("1310", "100.00", "0", dim), L("1300", "0", "100.00", dim)]);
await entry(RAIL, "rail-settled-R-1", "Railman settled R-1",
  [L("1200", "100.00", "0", dim), L("1310", "0", "100.00", dim)]);

// 4. replay seguro: reenviar pending no duplica
const before = (await query("register", RAIL)).result["result/count"];
const replay = await command("entry/accept", "rail-pending-R-1",
  { "ledger/id": RAIL, "posting/effective-date": D,
    "posting/description": "Railman pending R-1",
    "posting/lines": [L("1310", "100.00", "0", dim), L("1300", "0", "100.00", dim)] });
const after = (await query("register", RAIL)).result["result/count"];
check("replay no duplica", before === after && replay["receipt/status"] !== undefined);

// 5. negativo: descuadrado se rechaza
const bad = await command("entry/accept", "demo-bad-1",
  { "ledger/id": CORE, "posting/effective-date": D, "posting/description": "x",
    "posting/lines": [L("1100", "10.00", "0"), L("1210", "0", "9.00")] });
check("descuadrado rechazado", bad["receipt/status"] === "rejected");

// 6. lecturas
const coreTB = (await query("trial-balance", CORE)).result["result/rows"];
const coreBy = Object.fromEntries(coreTB.map((r) => [r["account/code"], r]));
check("1100 Dr 1000", coreBy["1100"]?.balance === "1000.00");
check("4110 Cr 5 (fee)", coreBy["4110"]?.balance === "5.00");
const railTB = (await query("trial-balance", RAIL)).result["result/rows"];
const railBy = Object.fromEntries(railTB.map((r) => [r["account/code"], r]));
check("riel 1200 Dr 100", railBy["1200"]?.balance === "100.00");
check("riel clearing cero",
  !railBy["1310"] || railBy["1310"].balance === "0.00");
const reg = (await query("register", RAIL)).result["result/entries"];
check("register riel 4 líneas con intent",
  reg.length === 4 && reg.every((l) => l["line/dimensions"]?.railIntentId === "R-1"));
const income = (await query("income", CORE)).result;
check("income fee 5", income["result/revenue"] === "5");

console.log(fails === 0 ? "\nDEMO VERDE" : `\nDEMO CON ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
