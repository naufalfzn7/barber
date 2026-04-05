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

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function plusDaysString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function findFirstAvailableSlot({ branchId, serviceId, memberCookie }) {
  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const date = plusDaysString(dayOffset);
    const slots = await jsonReq(
      `/api/bookings/slots?branchId=${branchId}&serviceId=${serviceId}&date=${date}`,
      { headers: { cookie: memberCookie } },
    );

    if (slots.res.status !== 200) {
      continue;
    }

    const first = Array.isArray(slots.body?.slots) ? slots.body.slots[0] : null;
    if (first?.start) {
      return { date, start: first.start };
    }
  }

  return null;
}

(async () => {
  const out = [];
  let holidayId = null;

  // A: health db
  {
    const { res, body } = await jsonReq("/api/health/db");
    assert(res.status === 200, `A fail status=${res.status}`);
    assert(body?.status === "ok", "A fail invalid body");
    out.push("A:PASS");
  }

  // C: login all needed roles
  let adminCookie = "";
  let memberCookie = "";
  let superCookie = "";
  {
    const adminLogin = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin.ska@monarchbarber.id",
        password: "Monarch123!",
      }),
    });
    const adminBody = await adminLogin.json().catch(() => ({}));
    assert(
      adminLogin.status === 200,
      `C fail admin login status=${adminLogin.status} body=${JSON.stringify(adminBody)}`,
    );
    adminCookie = pickCookie(
      adminLogin.headers.getSetCookie?.() ||
        adminLogin.headers.get("set-cookie"),
    );
    assert(!!adminCookie, "C fail missing admin cookie");

    const memberLogin = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "member.demo@monarchbarber.id",
        password: "Monarch123!",
      }),
    });
    const memberBody = await memberLogin.json().catch(() => ({}));
    assert(
      memberLogin.status === 200,
      `C fail member login status=${memberLogin.status} body=${JSON.stringify(memberBody)}`,
    );
    memberCookie = pickCookie(
      memberLogin.headers.getSetCookie?.() ||
        memberLogin.headers.get("set-cookie"),
    );
    assert(!!memberCookie, "C fail missing member cookie");

    const superLogin = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@monarchbarber.id",
        password: "Monarch123!",
      }),
    });
    const superBody = await superLogin.json().catch(() => ({}));
    assert(
      superLogin.status === 200,
      `C fail superadmin login status=${superLogin.status} body=${JSON.stringify(superBody)}`,
    );
    superCookie = pickCookie(
      superLogin.headers.getSetCookie?.() ||
        superLogin.headers.get("set-cookie"),
    );
    assert(!!superCookie, "C fail missing superadmin cookie");

    out.push("C:PASS");
  }

  const catalog = await jsonReq("/api/bookings/catalog", {
    headers: { cookie: adminCookie },
  });
  assert(
    catalog.res.status === 200,
    `B fail catalog status=${catalog.res.status}`,
  );
  const branch = catalog.body?.branches?.[0];
  const service = branch?.services?.[0];
  assert(branch && service, "B fail missing branch/service");

  const availableSlot = await findFirstAvailableSlot({
    branchId: branch.id,
    serviceId: service.id,
    memberCookie,
  });
  assert(availableSlot, "B fail no available slot found in next 14 days");

  out.push("B:PASS");

  // D: member endpoints
  {
    const slots = await jsonReq(
      `/api/bookings/slots?branchId=${branch.id}&serviceId=${service.id}&date=${availableSlot.date}`,
      { headers: { cookie: memberCookie } },
    );
    assert(slots.res.status === 200, `D fail slots status=${slots.res.status}`);

    const my = await jsonReq("/api/bookings/my", {
      headers: { cookie: memberCookie },
    });
    assert(my.res.status === 200, `D fail my status=${my.res.status}`);
    out.push("D:PASS");
  }

  // E: admin ops basics
  {
    const dash = await jsonReq("/api/bookings/admin/today", {
      headers: { cookie: adminCookie },
    });
    assert(
      dash.res.status === 200,
      `E fail dashboard status=${dash.res.status}`,
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

  // F: payment cash flow
  {
    const walkin = await jsonReq("/api/bookings/admin/walk-in", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        branchId: branch.id,
        serviceId: service.id,
        scheduledStart: availableSlot.start,
        walkInName: "Regression AH Cash",
      }),
    });
    assert(
      walkin.res.status === 201,
      `F fail walkin status=${walkin.res.status}`,
    );

    const bookingId = walkin.body?.booking?.id;
    assert(bookingId, "F fail missing bookingId");

    const inProgress = await jsonReq(
      `/api/bookings/admin/${bookingId}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ status: "IN_PROGRESS", branchId: branch.id }),
      },
    );
    assert(
      inProgress.res.status === 200,
      `F fail set in progress status=${inProgress.res.status}`,
    );

    const pay = await jsonReq("/api/payments/complete", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        bookingId,
        method: "CASH",
        amountPaid: Number(service.price) + 10000,
      }),
    });
    assert(pay.res.status === 200, `F fail payment status=${pay.res.status}`);

    const detail = await jsonReq(`/api/payments/booking/${bookingId}`, {
      headers: { cookie: adminCookie },
    });
    assert(
      detail.res.status === 200,
      `F fail detail status=${detail.res.status}`,
    );
    assert(detail.body?.payment?.status === "PAID", "F fail payment not PAID");
    assert(
      detail.body?.booking?.status === "COMPLETED",
      "F fail booking not COMPLETED",
    );

    out.push("F:PASS");
  }

  // G: inventory basics
  {
    const listItems = await jsonReq(
      `/api/inventory/items?branchId=${branch.id}`,
      {
        headers: { cookie: adminCookie },
      },
    );
    assert(
      listItems.res.status === 200,
      `G fail list items status=${listItems.res.status}`,
    );

    const sku = `RGH-${Date.now().toString().slice(-6)}`;
    const createItem = await jsonReq("/api/inventory/items", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        branchId: branch.id,
        sku,
        name: `Regression Item ${sku}`,
        stockQty: 2,
        minStockQty: 2,
      }),
    });
    assert(
      createItem.res.status === 201,
      `G fail create item status=${createItem.res.status}`,
    );
    const itemId = createItem.body?.item?.id;
    assert(itemId, "G fail missing item id");

    const move = await jsonReq("/api/inventory/movements", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        branchId: branch.id,
        itemId,
        type: "OUT",
        quantity: 1,
        note: "Regression A-H",
      }),
    });
    assert(
      move.res.status === 201,
      `G fail movement status=${move.res.status}`,
    );

    const alerts = await jsonReq(
      `/api/inventory/alerts?branchId=${branch.id}`,
      {
        headers: { cookie: adminCookie },
      },
    );
    assert(
      alerts.res.status === 200,
      `G fail alerts status=${alerts.res.status}`,
    );

    const movements = await jsonReq(
      `/api/inventory/movements?branchId=${branch.id}&itemId=${itemId}&limit=5`,
      { headers: { cookie: adminCookie } },
    );
    assert(
      movements.res.status === 200,
      `G fail list movements status=${movements.res.status}`,
    );

    out.push("G:PASS");
  }

  // H: scheduling + slot validation
  try {
    const operating = await jsonReq(
      `/api/scheduling/operating-hours?branchId=${branch.id}`,
      { headers: { cookie: superCookie } },
    );
    assert(
      operating.res.status === 200,
      `H fail operating hours status=${operating.res.status}`,
    );

    const barberSchedules = await jsonReq(
      `/api/scheduling/barber-schedules?branchId=${branch.id}&date=${todayString()}`,
      { headers: { cookie: superCookie } },
    );
    assert(
      barberSchedules.res.status === 200,
      `H fail barber schedules status=${barberSchedules.res.status}`,
    );

    const holidays = await jsonReq(
      `/api/scheduling/holidays?branchId=${branch.id}`,
      {
        headers: { cookie: superCookie },
      },
    );
    assert(
      holidays.res.status === 200,
      `H fail holidays status=${holidays.res.status}`,
    );

    const holidayDate = availableSlot.date;
    const createHoliday = await jsonReq("/api/scheduling/holidays", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: superCookie },
      body: JSON.stringify({
        branchId: branch.id,
        date: holidayDate,
        isFullDay: true,
        reason: "Regression A-H full day",
      }),
    });
    assert(
      createHoliday.res.status === 201,
      `H fail create holiday status=${createHoliday.res.status}`,
    );

    holidayId = createHoliday.body?.data?.id ?? null;
    assert(holidayId, "H fail missing holiday id");

    const blockedSlots = await jsonReq(
      `/api/bookings/slots?branchId=${branch.id}&serviceId=${service.id}&date=${holidayDate}`,
      { headers: { cookie: memberCookie } },
    );
    assert(
      blockedSlots.res.status === 200,
      `H fail slots status on holiday=${blockedSlots.res.status}`,
    );
    assert(
      Array.isArray(blockedSlots.body?.slots) &&
        blockedSlots.body.slots.length === 0,
      "H fail slots should be empty on branch full-day holiday",
    );

    out.push("H:PASS");
  } finally {
    if (holidayId) {
      await jsonReq(
        `/api/scheduling/holidays/${holidayId}?branchId=${branch.id}`,
        {
          method: "DELETE",
          headers: { cookie: superCookie },
        },
      );
    }
  }

  console.log("REGRESSION_A_H", out.join(","));
  console.log("REGRESSION_RESULT PASS");
})();
