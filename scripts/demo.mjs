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

// 3. FX: cliente compra 50 USD con 1000 MXN (costo 980 + fee 10 → spread 20)
const fxDim = (role) => ({ purchaseId: "FX-1", providerReference: " prov-9", role });
await entry(CORE, "core-fx-1-usd", "FX settlement USD credit FX-1",
  [{ ...L("1101", "50.00", "0"), "line/commodity": "USD",
     "line/party-code": "CLI-1", "line/dimensions": fxDim("target_cash") },
   { ...L("1210", "0", "50.00"), "line/commodity": "USD",
     "line/party-code": "CLI-1", "line/dimensions": fxDim("customer_available") }]);
await entry(CORE, "core-fx-1-mxn", "FX settlement MXN FX-1",
  [{ ...L("1230", "1000.00", "0"), "line/party-code": "CLI-1", "line/dimensions": fxDim("customer_consumed_clear") },
   { ...L("5100", "10.00", "0"), "line/party-code": "CLI-1", "line/dimensions": fxDim("provider_fee") },
   { ...L("1100", "0", "990.00"), "line/party-code": "CLI-1", "line/dimensions": fxDim("source_cash") },
   { ...L("4100", "0", "20.00"), "line/party-code": "CLI-1", "line/dimensions": fxDim("fx_spread_revenue") }]);

// 4. riel pending→settled 100 (intent R-1)
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
check("1100 Dr 10 (1000 funding - 990 FX)", coreBy["1100"]?.balance === "10.00");
check("4110 Cr 5 (fee)", coreBy["4110"]?.balance === "5.00");
const railTB = (await query("trial-balance", RAIL)).result["result/rows"];
const railBy = Object.fromEntries(railTB.map((r) => [r["account/code"], r]));
check("riel 1200 Dr 100", railBy["1200"]?.balance === "100.00");
check("riel clearing cero",
  !railBy["1310"] || railBy["1310"].balance === "0.00");
const reg = (await query("register", RAIL)).result["result/entries"];
check("register riel 4 líneas con intent",
  reg.length === 4 && reg.every((l) => l["line/dimensions"]?.railIntentId === "R-1"));
const income = (await query("income commodity MXN", CORE)).result;
check("income MXN revenue 25", income["result/revenue"] === "25");
check("income MXN expenses 10 (fee)", income["result/expenses"] === "10");
check("income MXN net 15", income["result/net-income"] === "15");
check("FX spread 20 en 4100",
  (await query("trial-balance", CORE)).result["result/rows"]
    .find((r) => r["account/code"] === "4100")?.balance === "20.00");
const usdBal = (await query("trial-balance", CORE)).result["result/rows"]
  .filter((r) => r.commodity === "USD");
check("1101 USD Dr 50",
  usdBal.find((r) => r["account/code"] === "1101")?.balance === "50.00");

console.log(fails === 0 ? "\nDEMO VERDE" : `\nDEMO CON ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
