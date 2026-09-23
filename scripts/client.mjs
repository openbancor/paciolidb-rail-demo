// Cliente mínimo del contrato PacioliDB v1 (fetch, sin deps).
export const API = process.env.PACIOLI_API || "http://localhost:8787";
const TOKEN = process.env.PACIOLI_TOKEN || "demo-local-token";
const H = { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };

export async function status() {
  const r = await fetch(`${API}/status`);
  return r.json();
}

export async function command(op, id, input) {
  const st = await status();
  const body = {
    "command/id": id,
    "command/op": op,
    "command/expected-basis": st.basis ?? st["db/basis"] ?? 0,
    "command/input": input,
  };
  const r = await fetch(`${API}/command`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function query(text, ledgerId) {
  const r = await fetch(`${API}/query`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ query: text, "ledger-id": ledgerId }),
  });
  return r.json();
}

export const ok = (rc, what) => {
  if (rc["receipt/status"] !== "accepted")
    throw new Error(`${what} rechazado: ${JSON.stringify(rc).slice(0, 300)}`);
  return rc;
};
