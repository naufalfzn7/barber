const base = "http://127.0.0.1:3000";
const adminEmail = "admin.ska@monarchbarber.id";
const adminPassword = "Monarch123!";
const token = process.env.XENDIT_WEBHOOK_TOKEN || "";

function pickCookie(setCookieHeaders) {
  if (!setCookieHeaders) return "";
  const arr = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];
  return arr.map((v) => String(v).split(";")[0]).join("; ");
}

async function req(path, opts = {}) {
  const res = await fetch(base + path, opts);
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { res, json };
}

function todayDateString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

(async () => {
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const loginJson = await login.json().catch(() => ({}));
  if (!login.ok) {
    console.log("LOGIN_FAIL", login.status, JSON.stringify(loginJson));
    process.exit(1);
  }

  const cookie = pickCookie(
    login.headers.getSetCookie?.() || login.headers.get("set-cookie"),
  );
  if (!cookie) {
    console.log("COOKIE_FAIL no auth cookie");
    process.exit(1);
  }

  const catalog = await req("/api/bookings/catalog", { headers: { cookie } });
  if (!catalog.res.ok) {
    console.log(
      "CATALOG_FAIL",
      catalog.res.status,
      JSON.stringify(catalog.json),
    );
    process.exit(1);
  }

  const branch = catalog.json?.branches?.[0];
  const service = branch?.services?.[0];
  if (!branch || !service) {
    console.log("CATALOG_EMPTY");
    process.exit(1);
  }

  let bookingId = null;
  const dash = await req(
    `/api/bookings/admin/today?date=${todayDateString()}`,
    { headers: { cookie } },
  );
  if (dash.res.ok) {
    const candidate = (dash.json?.bookings || []).find(
      (b) => b.status === "UPCOMING",
    );
    if (candidate) bookingId = candidate.id;
  }

  if (!bookingId) {
    const start = new Date();
    start.setMinutes(start.getMinutes() + 35);
    start.setSeconds(0, 0);

    const walkin = await req("/api/bookings/admin/walk-in", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        branchId: branch.id,
        serviceId: service.id,
        scheduledStart: start.toISOString(),
        walkInName: "Webhook Valid Ref Test",
        walkInPhone: "081234567890",
      }),
    });

    if (!walkin.res.ok) {
      console.log(
        "WALKIN_FAIL",
        walkin.res.status,
        JSON.stringify(walkin.json),
      );
      process.exit(1);
    }
    bookingId = walkin.json?.booking?.id;
  }

  const inProgress = await req(`/api/bookings/admin/${bookingId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "IN_PROGRESS", branchId: branch.id }),
  });

  if (
    !(
      inProgress.res.ok ||
      (inProgress.res.status === 400 &&
        String(inProgress.json?.message || "").includes(
          "Invalid booking status transition",
        ))
    )
  ) {
    console.log(
      "INPROGRESS_FAIL",
      inProgress.res.status,
      JSON.stringify(inProgress.json),
    );
    process.exit(1);
  }

  const initQris = await req("/api/payments/complete", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ bookingId, method: "QRIS" }),
  });

  if (!initQris.res.ok) {
    console.log(
      "QRIS_INIT_FAIL",
      initQris.res.status,
      JSON.stringify(initQris.json),
    );
    process.exit(1);
  }

  const ref =
    initQris.json?.result?.qris?.referenceId ||
    initQris.json?.result?.payment?.externalRef;
  if (!ref) {
    console.log("REF_MISSING", JSON.stringify(initQris.json));
    process.exit(1);
  }

  const webhook = await req("/api/payments/webhook/xendit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-callback-token": token } : {}),
    },
    body: JSON.stringify({
      event: "qr.payment",
      data: {
        reference_id: ref,
        status: "SUCCEEDED",
        created: new Date().toISOString(),
      },
    }),
  });

  if (!webhook.res.ok) {
    console.log(
      "WEBHOOK_FAIL",
      webhook.res.status,
      JSON.stringify(webhook.json),
    );
    process.exit(1);
  }

  const payment = await req(`/api/payments/booking/${bookingId}`, {
    headers: { cookie },
  });
  if (!payment.res.ok) {
    console.log(
      "PAYMENT_FETCH_FAIL",
      payment.res.status,
      JSON.stringify(payment.json),
    );
    process.exit(1);
  }

  console.log("BOOKING_ID", bookingId);
  console.log("QRIS_REF", ref);
  console.log(
    "WEBHOOK_STATUS",
    webhook.res.status,
    JSON.stringify(webhook.json),
  );
  console.log("FINAL_PAYMENT_METHOD", payment.json?.payment?.method);
  console.log("FINAL_PAYMENT_STATUS", payment.json?.payment?.status);
  console.log("FINAL_BOOKING_STATUS", payment.json?.booking?.status);

  const ok =
    payment.json?.payment?.status === "PAID" &&
    payment.json?.booking?.status === "COMPLETED";
  console.log("E2E_RESULT", ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 2);
})();
