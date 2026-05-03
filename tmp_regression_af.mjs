const base = "http://127.0.0.1:3000";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function pickCookie(setCookieHeaders) {
  if (!setCookieHeaders) return "";
  const arr = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];
  return arr.map((v) => String(v).split(";")[0]).join("; ");
}

async function jsonReq(path, options = {}) {
  const res = await fetch(base + path, options);
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { res, body };
}

(async () => {
  const out = [];

  // A: Health/DB
  {
    const { res, body } = await jsonReq("/api/health/db");
    assert(res.status === 200, `A fail health status=${res.status}`);
    assert(body?.status === "ok", "A fail health body.status");
    out.push("A:PASS");
  }

  // C: Auth login/admin + me
  let adminCookie = "";
  {
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin.ska@monarchbarber.id",
        password: "Monarch123!",
      }),
    });
    const loginBody = await login.json().catch(() => ({}));
    assert(
      login.status === 200,
      `C fail login status=${login.status} body=${JSON.stringify(loginBody)}`,
    );
    adminCookie = pickCookie(
      login.headers.getSetCookie?.() || login.headers.get("set-cookie"),
    );
    assert(!!adminCookie, "C fail missing admin cookie");

    const me = await jsonReq("/api/auth/me", {
      headers: { cookie: adminCookie },
    });
    assert(me.res.status === 200, `C fail /me status=${me.res.status}`);
    assert(
      me.body?.user?.role === "ADMIN",
      `C fail /me role=${me.body?.user?.role}`,
    );
    out.push("C:PASS");
  }

  // D/E pre-req: member login and core booking endpoints
  let memberCookie = "";
  let branch;
  let service;
  {
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "member.demo@monarchbarber.id",
        password: "Monarch123!",
      }),
    });
    const loginBody = await login.json().catch(() => ({}));
    assert(
      login.status === 200,
      `D fail member login status=${login.status} body=${JSON.stringify(loginBody)}`,
    );
    memberCookie = pickCookie(
      login.headers.getSetCookie?.() || login.headers.get("set-cookie"),
    );
    assert(!!memberCookie, "D fail missing member cookie");

    const catalog = await jsonReq("/api/bookings/catalog", {
      headers: { cookie: memberCookie },
    });
    assert(
      catalog.res.status === 200,
      `D fail catalog status=${catalog.res.status}`,
    );
    branch = catalog.body?.branches?.[0];
    service = branch?.services?.[0];
    assert(branch && service, "D fail empty branch/service catalog");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const date = `${yyyy}-${mm}-${dd}`;

    const slots = await jsonReq(
      `/api/bookings/slots?branchId=${branch.id}&serviceId=${service.id}&date=${date}`,
      {
        headers: { cookie: memberCookie },
      },
    );
    assert(slots.res.status === 200, `D fail slots status=${slots.res.status}`);

    const history = await jsonReq("/api/bookings/my", {
      headers: { cookie: memberCookie },
    });
    assert(
      history.res.status === 200,
      `D fail my history status=${history.res.status}`,
    );
    out.push("D:PASS");
  }

  // E: Admin daily dashboard and members endpoint
  {
    const dashboard = await jsonReq("/api/bookings/admin/today", {
      headers: { cookie: adminCookie },
    });
    assert(
      dashboard.res.status === 200,
      `E fail admin dashboard status=${dashboard.res.status}`,
    );

    const members = await jsonReq("/api/members", {
      headers: { cookie: adminCookie },
    });
    assert(
      members.res.status === 200,
      `E fail members status=${members.res.status}`,
    );
    out.push("E:PASS");
  }

  // F: Payment flow (cash + qris webhook)
  {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 45);
    now.setSeconds(0, 0);

    const walkin = await jsonReq("/api/bookings/admin/walk-in", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        branchId: branch.id,
        serviceId: service.id,
        scheduledStart: '2026-04-29T05:00:00.000Z',
        walkInName: "Regression AF Cash",
      }),
    });
    assert(
      walkin.res.status === 201,
      `F fail create walkin(cash) status=${walkin.res.status}`,
    );
    const cashBookingId = walkin.body?.booking?.id;
    assert(cashBookingId, "F fail missing cash booking id");

    const inProgress = await jsonReq(
      `/api/bookings/admin/${cashBookingId}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ status: "IN_PROGRESS", branchId: branch.id }),
      },
    );
    assert(
      inProgress.res.status === 200,
      `F fail set in_progress(cash) status=${inProgress.res.status}`,
    );

    const cashPay = await jsonReq("/api/payments/complete", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        bookingId: cashBookingId,
        method: "CASH",
        amountPaid: Number(service.price) + 10000,
      }),
    });
    assert(
      cashPay.res.status === 200,
      `F fail cash pay status=${cashPay.res.status}`,
    );

    const cashDetail = await jsonReq(`/api/payments/booking/${cashBookingId}`, {
      headers: { cookie: adminCookie },
    });
    assert(
      cashDetail.res.status === 200,
      `F fail cash detail status=${cashDetail.res.status}`,
    );
    assert(
      cashDetail.body?.payment?.status === "PAID",
      "F fail cash payment not PAID",
    );
    assert(
      cashDetail.body?.booking?.status === "COMPLETED",
      "F fail cash booking not COMPLETED",
    );

    const walkinQ = await jsonReq("/api/bookings/admin/walk-in", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        branchId: branch.id,
        serviceId: service.id,
        scheduledStart: '2026-04-29T07:00:00.000Z',
        walkInName: "Regression AF QRIS",
      }),
    });
    assert(
      walkinQ.res.status === 201 || console.error(walkinQ.body),
      `F fail create walkin(qris) status=${walkinQ.res.status}`,
    );
    const qBookingId = walkinQ.body?.booking?.id;
    assert(qBookingId, "F fail missing qris booking id");

    const inProgressQ = await jsonReq(
      `/api/bookings/admin/${qBookingId}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ status: "IN_PROGRESS", branchId: branch.id }),
      },
    );
    assert(
      inProgressQ.res.status === 200,
      `F fail set in_progress(qris) status=${inProgressQ.res.status}`,
    );

    const qrisInit = await jsonReq("/api/payments/complete", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ bookingId: qBookingId, method: "QRIS" }),
    });
    assert(
      qrisInit.res.status === 202,
      `F fail qris init status=${qrisInit.res.status}`,
    );

    const ref =
      qrisInit.body?.result?.qris?.referenceId ||
      qrisInit.body?.result?.payment?.externalRef;
    assert(ref, "F fail missing qris reference");

    const tok = process.env.XENDIT_WEBHOOK_TOKEN || "";
    const webhook = await jsonReq("/api/payments/webhook/xendit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(tok ? { "x-callback-token": tok } : {}),
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
    assert(
      webhook.res.status === 200,
      `F fail webhook status=${webhook.res.status} body=${JSON.stringify(webhook.body)}`,
    );

    const qDetail = await jsonReq(`/api/payments/booking/${qBookingId}`, {
      headers: { cookie: adminCookie },
    });
    assert(
      qDetail.res.status === 200,
      `F fail qris detail status=${qDetail.res.status}`,
    );
    assert(
      qDetail.body?.payment?.status === "PAID",
      "F fail qris payment not PAID",
    );
    assert(
      qDetail.body?.booking?.status === "COMPLETED",
      "F fail qris booking not COMPLETED",
    );

    out.push("F:PASS");
  }

  console.log("REGRESSION_A_F", out.join(","));
  console.log("REGRESSION_RESULT PASS");
})();
