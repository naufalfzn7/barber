const base = "http://127.0.0.1:3000";

function pickCookie(setCookieHeaders) {
  if (!setCookieHeaders) return "";
  const arr = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];
  return arr.map((v) => String(v).split(";")[0]).join("; ");
}

async function j(path, opts = {}) {
  const r = await fetch(base + path, opts);
  let b = null;
  try {
    b = await r.json();
  } catch {}
  return { r, b };
}

(async () => {
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin.ska@monarchbarber.id",
      password: "Monarch123!",
    }),
  });
  const lb = await login.json().catch(() => ({}));
  if (!login.ok) {
    console.log("LOGIN_FAIL", login.status, JSON.stringify(lb));
    process.exit(1);
  }

  const cookie = pickCookie(
    login.headers.getSetCookie?.() || login.headers.get("set-cookie"),
  );
  const catalog = await j("/api/bookings/catalog", { headers: { cookie } });
  const branchId = catalog.b?.branches?.[0]?.id;
  if (!branchId) {
    console.log("BRANCH_FAIL", catalog.r.status, JSON.stringify(catalog.b));
    process.exit(1);
  }

  const list1 = await j(`/api/inventory/items?branchId=${branchId}`, {
    headers: { cookie },
  });
  console.log(
    "LIST_ITEMS_STATUS",
    list1.r.status,
    "COUNT",
    list1.b?.items?.length ?? -1,
  );

  const sku = "INV-" + Date.now().toString().slice(-6);
  const create = await j("/api/inventory/items", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      branchId,
      sku,
      name: "Pomade Test " + sku,
      stockQty: 1,
      minStockQty: 3,
    }),
  });
  console.log("CREATE_ITEM_STATUS", create.r.status, create.b?.message || "");
  if (!create.r.ok) {
    process.exit(2);
  }

  const itemId = create.b?.item?.id;

  const move = await j("/api/inventory/movements", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      branchId,
      itemId,
      type: "OUT",
      quantity: 1,
      note: "Regression low stock",
    }),
  });
  console.log("MOVE_STATUS", move.r.status, move.b?.message || "");

  const alerts = await j(`/api/inventory/alerts?branchId=${branchId}`, {
    headers: { cookie },
  });
  console.log(
    "ALERTS_STATUS",
    alerts.r.status,
    "ALERT_COUNT",
    alerts.b?.alerts?.length ?? -1,
  );

  const movements = await j(
    `/api/inventory/movements?branchId=${branchId}&itemId=${itemId}&limit=5`,
    { headers: { cookie } },
  );
  console.log(
    "MOVEMENTS_STATUS",
    movements.r.status,
    "MOVE_COUNT",
    movements.b?.movements?.length ?? -1,
  );

  const ok =
    list1.r.ok && create.r.ok && move.r.ok && alerts.r.ok && movements.r.ok;
  console.log("INVENTORY_SMOKE", ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 3);
})();
