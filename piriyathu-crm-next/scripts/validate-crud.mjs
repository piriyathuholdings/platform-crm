#!/usr/bin/env node

const NEXT_BASE_URL = process.env.NEXT_BASE_URL || "http://127.0.0.1:3000";
const LOGIN_EMAIL = process.env.CRM_TEST_EMAIL || "business.admin@cmate.local";
const LOGIN_PASSWORD = process.env.CRM_TEST_PASSWORD || "Admin#12345";

const cookieJar = new Map();

function uniqueToken(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function setCookie(name, value) {
  cookieJar.set(name, value);
}

function getCookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function updateCookiesFromResponse(response) {
  const headers = response.headers;
  const getter = headers.getSetCookie;
  const setCookies =
    typeof getter === "function"
      ? getter.call(headers)
      : (headers.get("set-cookie") || "")
          .split(/,(?=\s*[^;=,\s]+=[^;,]+)/g)
          .map((entry) => entry.trim())
          .filter(Boolean);

  for (const setCookieHeader of setCookies) {
    const firstChunk = setCookieHeader.split(";")[0];
    const eqIndex = firstChunk.indexOf("=");
    if (eqIndex <= 0) continue;
    const name = firstChunk.slice(0, eqIndex).trim();
    const value = firstChunk.slice(eqIndex + 1).trim();
    if (!name) continue;
    if (!value) {
      cookieJar.delete(name);
    } else {
      setCookie(name, value);
    }
  }
}

async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const cookie = getCookieHeader();
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${NEXT_BASE_URL}/api/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  updateCookiesFromResponse(response);

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.error) {
    const message =
      payload?.error?.message ||
      payload?.detail ||
      payload?.message ||
      `Request failed (${response.status}) for ${method} ${path}`;
    throw new Error(message);
  }

  return payload?.data;
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertListContains(endpoint, id) {
  const list = await api(`/${endpoint}?limit=500&offset=0`);
  const items = Array.isArray(list?.items) ? list.items : [];
  ensure(items.some((item) => String(item.id) === String(id)), `List check failed for ${endpoint}: missing ${id}`);
}

async function run() {
  const cleanup = [];
  const report = [];

  const track = (label, status, detail = "") => {
    report.push({ label, status, detail });
    console.log(`[${status}] ${label}${detail ? ` - ${detail}` : ""}`);
  };

  try {
    await api("/auth/login", {
      method: "POST",
      body: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }
    });
    track("Auth login", "PASS");

    const me = await api("/auth/me");
    ensure(typeof me?.email === "string" && me.email.length > 0, "Unable to resolve authenticated user context");
    const assignedTo = me.email;
    track("Auth context", "PASS", assignedTo);

    const productCode = uniqueToken("PROD");
    const product = await api("/products", {
      method: "POST",
      body: {
        product_code: productCode,
        product_name: `CRUD Product ${productCode}`,
        product_type: "Validation",
        is_active: 1
      }
    });
    ensure(product?.id, "Product create failed");
    cleanup.push({ endpoint: "products", id: product.id });
    await api(`/products/${encodeURIComponent(product.id)}`);
    await api(`/products/${encodeURIComponent(product.id)}`, {
      method: "PATCH",
      body: { product_type: "Validation-Updated" }
    });
    await assertListContains("products", product.id);
    track("Product CRUD", "PASS", String(product.id));

    const userEmail = `${uniqueToken("crud.user")}@cmate.local`;
    const user = await api("/users", {
      method: "POST",
      body: {
        email: userEmail,
        full_name: "CRUD Validation User",
        temporary_password: "Temp#12345",
        roles: ["BUSINESS_USER"]
      }
    });
    ensure(user?.id, "User create failed");
    cleanup.push({ endpoint: "users", id: user.id });
    await api(`/users/${encodeURIComponent(user.id)}`);
    await api(`/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: { full_name: "CRUD Validation User Updated" }
    });
    await assertListContains("users", user.id);
    track("User CRUD", "PASS", String(user.id));

    const upa = await api("/user-product-access", {
      method: "POST",
      body: {
        user: user.id,
        product: product.id,
        role_in_product: "Tester",
        is_active: 1
      }
    });
    ensure(upa?.id, "User Product Access create failed");
    cleanup.push({ endpoint: "user-product-access", id: upa.id });
    await api(`/user-product-access/${encodeURIComponent(upa.id)}`);
    await api(`/user-product-access/${encodeURIComponent(upa.id)}`, {
      method: "PATCH",
      body: { role_in_product: "Lead Tester" }
    });
    await assertListContains("user-product-access", upa.id);
    track("User Product Access CRUD", "PASS", String(upa.id));

    const organization = await api("/organizations", {
      method: "POST",
      body: {
        organization_name: `CRUD Org ${uniqueToken("ORG")}`,
        product: product.id,
        assigned_to: assignedTo,
        status: "Active"
      }
    });
    ensure(organization?.id, "Organization create failed");
    cleanup.push({ endpoint: "organizations", id: organization.id });
    await api(`/organizations/${encodeURIComponent(organization.id)}`);
    await api(`/organizations/${encodeURIComponent(organization.id)}`, {
      method: "PATCH",
      body: { industry: "SaaS" }
    });
    await assertListContains("organizations", organization.id);
    track("Organization CRUD", "PASS", String(organization.id));

    const contact = await api("/contacts", {
      method: "POST",
      body: {
        full_name: `CRUD Contact ${uniqueToken("CONT")}`,
        product: product.id,
        assigned_to: assignedTo,
        organization: organization.id,
        email: `${uniqueToken("contact")}@example.com`
      }
    });
    ensure(contact?.id, "Contact create failed");
    cleanup.push({ endpoint: "contacts", id: contact.id });
    await api(`/contacts/${encodeURIComponent(contact.id)}`);
    await api(`/contacts/${encodeURIComponent(contact.id)}`, {
      method: "PATCH",
      body: { mobile_no: "9999999999" }
    });
    await assertListContains("contacts", contact.id);
    track("Contact CRUD", "PASS", String(contact.id));

    const lead = await api("/leads", {
      method: "POST",
      body: {
        lead_name: `CRUD Lead ${uniqueToken("LEAD")}`,
        product: product.id,
        assigned_to: assignedTo,
        email: `${uniqueToken("lead")}@example.com`,
        organization: organization.id,
        status: "Open"
      }
    });
    ensure(lead?.id, "Lead create failed");
    cleanup.push({ endpoint: "leads", id: lead.id });
    await api(`/leads/${encodeURIComponent(lead.id)}`);
    await api(`/leads/${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      body: { status: "Qualified" }
    });
    await assertListContains("leads", lead.id);
    track("Lead CRUD", "PASS", String(lead.id));

    const deal = await api("/deals", {
      method: "POST",
      body: {
        deal_title: `CRUD Deal ${uniqueToken("DEAL")}`,
        product: product.id,
        assigned_to: assignedTo,
        lead: lead.id,
        organization: organization.id,
        contact: contact.id,
        deal_status: "Qualification",
        deal_value: 10000
      }
    });
    ensure(deal?.id, "Deal create failed");
    cleanup.push({ endpoint: "deals", id: deal.id });
    await api(`/deals/${encodeURIComponent(deal.id)}`);
    await api(`/deals/${encodeURIComponent(deal.id)}`, {
      method: "PATCH",
      body: {
        deal_status: "Discovery",
        deal_value: 12000,
        deal_value_change_reason: "CRUD validation value adjustment"
      }
    });
    await assertListContains("deals", deal.id);
    track("Deal CRUD", "PASS", String(deal.id));

    const task = await api("/tasks", {
      method: "POST",
      body: {
        title: `CRUD Task ${uniqueToken("TASK")}`,
        product: product.id,
        assigned_to: assignedTo,
        deal: deal.id,
        status: "Open",
        priority: "Medium"
      }
    });
    ensure(task?.id, "Task create failed");
    cleanup.push({ endpoint: "tasks", id: task.id });
    await api(`/tasks/${encodeURIComponent(task.id)}`);
    await api(`/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: { status: "In Progress" }
    });
    await assertListContains("tasks", task.id);
    track("Task CRUD", "PASS", String(task.id));

    const note = await api("/notes", {
      method: "POST",
      body: {
        title: `CRUD Note ${uniqueToken("NOTE")}`,
        product: product.id,
        assigned_to: assignedTo,
        deal: deal.id,
        note_content: "Validation note"
      }
    });
    ensure(note?.id, "Note create failed");
    cleanup.push({ endpoint: "notes", id: note.id });
    await api(`/notes/${encodeURIComponent(note.id)}`);
    await api(`/notes/${encodeURIComponent(note.id)}`, {
      method: "PATCH",
      body: { note_content: "Validation note updated" }
    });
    await assertListContains("notes", note.id);
    track("Note CRUD", "PASS", String(note.id));

    const activity = await api("/activities", {
      method: "POST",
      body: {
        subject: `CRUD Activity ${uniqueToken("ACT")}`,
        activity_type: "Call",
        product: product.id,
        assigned_to: assignedTo,
        deal: deal.id,
        status: "Planned"
      }
    });
    ensure(activity?.id, "Activity create failed");
    cleanup.push({ endpoint: "activities", id: activity.id });
    await api(`/activities/${encodeURIComponent(activity.id)}`);
    await api(`/activities/${encodeURIComponent(activity.id)}`, {
      method: "PATCH",
      body: { status: "Done" }
    });
    await assertListContains("activities", activity.id);
    track("Activity CRUD", "PASS", String(activity.id));

    const expense = await api("/expenses", {
      method: "POST",
      body: {
        expense_title: `CRUD Expense ${uniqueToken("EXP")}`,
        expense_scope: "Deal",
        product: product.id,
        assigned_to: assignedTo,
        deal: deal.id,
        amount: 500,
        status: "Draft"
      }
    });
    ensure(expense?.id, "Expense create failed");
    cleanup.push({ endpoint: "expenses", id: expense.id });
    await api(`/expenses/${encodeURIComponent(expense.id)}`);
    await api(`/expenses/${encodeURIComponent(expense.id)}`, {
      method: "PATCH",
      body: { status: "Approved", amount: 650 }
    });
    await assertListContains("expenses", expense.id);
    track("Expense CRUD", "PASS", String(expense.id));

    const payment = await api("/client-payments", {
      method: "POST",
      body: {
        product: product.id,
        assigned_to: assignedTo,
        deal: deal.id,
        payment_type: "Partial",
        status: "Expected",
        amount: 2000
      }
    });
    ensure(payment?.id, "Client Payment create failed");
    cleanup.push({ endpoint: "client-payments", id: payment.id });
    await api(`/client-payments/${encodeURIComponent(payment.id)}`);
    await api(`/client-payments/${encodeURIComponent(payment.id)}`, {
      method: "PATCH",
      body: { status: "Received", amount: 2500 }
    });
    await assertListContains("client-payments", payment.id);
    track("Client Payment CRUD", "PASS", String(payment.id));

    track("All CRUD validations", "PASS");
  } finally {
    for (const item of cleanup.reverse()) {
      try {
        await api(`/${item.endpoint}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        track(`Cleanup ${item.endpoint}`, "PASS", String(item.id));
      } catch (error) {
        track(`Cleanup ${item.endpoint}`, "WARN", error instanceof Error ? error.message : String(error));
      }
    }
  }
}

run()
  .then(() => {
    console.log("\nCRUD validation completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nCRUD validation failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
