"use client";

import { useState } from "react";

type Client = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  odooPartnerId?: number | null;
  createdAt: string;
};

type Order = {
  id: number;
  productName: string;
  amount: number;
  odooOrderId?: number | null;
  clientId: number;
  client?: Client;
  createdAt: string;
};

type Msg = { text: string; type: "ok" | "warn" | "err" } | null;

const msgClass: Record<string, string> = {
  ok: "bg-green-50 text-green-800 border border-green-200",
  warn: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  err: "bg-red-50 text-red-800 border border-red-200",
};

function SyncBadge({ id }: { id?: number | null }) {
  return id ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      ✓ #{id}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
      pending
    </span>
  );
}

function ActionBtn({
  onClick,
  disabled,
  variant = "ghost",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "ghost" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    variant === "danger"
      ? "text-red-500 hover:text-red-700"
      : "text-indigo-500 hover:text-indigo-700";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-medium disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

export default function Dashboard({
  initialClients,
  initialOrders,
}: {
  initialClients: Client[];
  initialOrders: Order[];
}) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  const [clientMsg, setClientMsg] = useState<Msg>(null);
  const [orderMsg, setOrderMsg] = useState<Msg>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);

  // Inline edit state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Per-row loading
  const [busyClient, setBusyClient] = useState<number | null>(null);
  const [busyOrder, setBusyOrder] = useState<number | null>(null);

  async function loadClients() {
    const res = await fetch("/api/clients");
    if (res.ok) setClients(await res.json());
  }
  async function loadOrders() {
    const res = await fetch("/api/orders");
    if (res.ok) setOrders(await res.json());
  }

  // ── Create client ──────────────────────────────────────────────────────────
  async function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientLoading(true);
    setClientMsg(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: fd.get("name"),
      email: fd.get("email"),
    };
    const phone = fd.get("phone");
    if (phone) body.phone = phone;

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : (data.message ?? "Request failed")
        );
      setClientMsg(
        data.odooWarning
          ? { text: `Client saved. Odoo: ${data.odooWarning}`, type: "warn" }
          : {
              text: `Client created and synced to Odoo (partner #${data.odooPartnerId})`,
              type: "ok",
            }
      );
      (e.target as HTMLFormElement).reset();
      await loadClients();
    } catch (err) {
      setClientMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setClientLoading(false);
    }
  }

  // ── Update client ──────────────────────────────────────────────────────────
  async function handleUpdateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClient) return;
    setBusyClient(editingClient.id);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone") || null,
    };
    try {
      const res = await fetch(`/api/clients/${editingClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : (data.message ?? "Request failed")
        );
      setEditingClient(null);
      await loadClients();
    } catch (err) {
      setClientMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setBusyClient(null);
    }
  }

  // ── Delete client ──────────────────────────────────────────────────────────
  async function handleDeleteClient(id: number) {
    if (!confirm("Delete this client? This cannot be undone.")) return;
    setBusyClient(id);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Delete failed");
      }
      await loadClients();
    } catch (err) {
      setClientMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setBusyClient(null);
    }
  }

  // ── Retry client sync ──────────────────────────────────────────────────────
  async function handleRetryClientSync(id: number) {
    setBusyClient(id);
    try {
      const res = await fetch(`/api/clients/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Sync failed");
      await loadClients();
    } catch (err) {
      setClientMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setBusyClient(null);
    }
  }

  // ── Create order ───────────────────────────────────────────────────────────
  async function handleCreateOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOrderLoading(true);
    setOrderMsg(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      clientId: Number(fd.get("clientId")),
      productName: fd.get("productName") as string,
      amount: Number(fd.get("amount")),
    };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : (data.message ?? "Request failed")
        );
      setOrderMsg(
        data.odooWarning
          ? { text: `Order saved. Odoo: ${data.odooWarning}`, type: "warn" }
          : {
              text: `Order created and synced to Odoo (order #${data.odooOrderId})`,
              type: "ok",
            }
      );
      (e.target as HTMLFormElement).reset();
      await Promise.all([loadOrders(), loadClients()]);
    } catch (err) {
      setOrderMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setOrderLoading(false);
    }
  }

  // ── Update order ───────────────────────────────────────────────────────────
  async function handleUpdateOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingOrder) return;
    setBusyOrder(editingOrder.id);
    const fd = new FormData(e.currentTarget);
    const body = {
      productName: fd.get("productName") as string,
      amount: Number(fd.get("amount")),
    };
    try {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : (data.message ?? "Request failed")
        );
      setEditingOrder(null);
      await loadOrders();
    } catch (err) {
      setOrderMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setBusyOrder(null);
    }
  }

  // ── Delete order ───────────────────────────────────────────────────────────
  async function handleDeleteOrder(id: number) {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    setBusyOrder(id);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Delete failed");
      }
      await loadOrders();
    } catch (err) {
      setOrderMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setBusyOrder(null);
    }
  }

  // ── Retry order sync ───────────────────────────────────────────────────────
  async function handleRetryOrderSync(id: number) {
    setBusyOrder(id);
    try {
      const res = await fetch(`/api/orders/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Sync failed");
      await loadOrders();
    } catch (err) {
      setOrderMsg({ text: (err as Error).message, type: "err" });
    } finally {
      setBusyOrder(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white px-8 py-4">
        <h1 className="text-lg font-semibold">
          Sikilli — Client &amp; Order Sync with Odoo
        </h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid gap-6">
        {/* Forms row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create client */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              New Client
            </h2>
            <form onSubmit={handleCreateClient} className="grid gap-3">
              <label className="grid gap-1 text-sm text-gray-600">
                Name *
                <input
                  name="name"
                  required
                  maxLength={100}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
              <label className="grid gap-1 text-sm text-gray-600">
                Email *
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
              <label className="grid gap-1 text-sm text-gray-600">
                Phone
                <input
                  name="phone"
                  maxLength={30}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
              <button
                type="submit"
                disabled={clientLoading}
                className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {clientLoading ? "Creating…" : "Create Client"}
              </button>
              {clientMsg && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${msgClass[clientMsg.type]}`}
                >
                  {clientMsg.text}
                </p>
              )}
            </form>
          </section>

          {/* Create order */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              New Order
            </h2>
            <form onSubmit={handleCreateOrder} className="grid gap-3">
              <label className="grid gap-1 text-sm text-gray-600">
                Client *
                <select
                  name="clientId"
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">— select a client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-gray-600">
                Product name *
                <input
                  name="productName"
                  required
                  maxLength={150}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
              <label className="grid gap-1 text-sm text-gray-600">
                Total price (CFA) *
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
              <button
                type="submit"
                disabled={orderLoading}
                className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {orderLoading ? "Creating…" : "Create Order"}
              </button>
              {orderMsg && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${msgClass[orderMsg.type]}`}
                >
                  {orderMsg.text}
                </p>
              )}
            </form>
          </section>
        </div>

        {/* Clients table */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Clients
            </h2>
            <button
              onClick={loadClients}
              className="text-xs text-indigo-600 hover:underline"
            >
              Refresh
            </button>
          </div>

          {/* Inline edit form */}
          {editingClient && (
            <form
              onSubmit={handleUpdateClient}
              className="mb-4 grid gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4"
            >
              <p className="text-xs font-medium text-indigo-700">
                Editing client #{editingClient.id}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <label className="grid gap-1 text-xs text-gray-600">
                  Name *
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={editingClient.name}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
                <label className="grid gap-1 text-xs text-gray-600">
                  Email *
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={150}
                    defaultValue={editingClient.email}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
                <label className="grid gap-1 text-xs text-gray-600">
                  Phone
                  <input
                    name="phone"
                    maxLength={30}
                    defaultValue={editingClient.phone ?? ""}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busyClient === editingClient.id}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busyClient === editingClient.id ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {clients.length === 0 ? (
            <p className="text-sm text-gray-400">No clients yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2 pr-4">Odoo</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-400">{c.id}</td>
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 pr-4 text-gray-600">{c.email}</td>
                      <td className="py-2 pr-4 text-gray-500">
                        {c.phone ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <SyncBadge id={c.odooPartnerId} />
                      </td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-3">
                          <ActionBtn
                            onClick={() => setEditingClient(c)}
                            disabled={busyClient === c.id}
                          >
                            Edit
                          </ActionBtn>
                          {!c.odooPartnerId && (
                            <ActionBtn
                              onClick={() => handleRetryClientSync(c.id)}
                              disabled={busyClient === c.id}
                            >
                              Sync
                            </ActionBtn>
                          )}
                          <ActionBtn
                            onClick={() => handleDeleteClient(c.id)}
                            disabled={busyClient === c.id}
                            variant="danger"
                          >
                            Delete
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Orders table */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Orders
            </h2>
            <button
              onClick={loadOrders}
              className="text-xs text-indigo-600 hover:underline"
            >
              Refresh
            </button>
          </div>

          {/* Inline edit form */}
          {editingOrder && (
            <form
              onSubmit={handleUpdateOrder}
              className="mb-4 grid gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4"
            >
              <p className="text-xs font-medium text-indigo-700">
                Editing order #{editingOrder.id}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs text-gray-600">
                  Product name *
                  <input
                    name="productName"
                    required
                    maxLength={150}
                    defaultValue={editingOrder.productName}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
                <label className="grid gap-1 text-xs text-gray-600">
                  Amount (CFA) *
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={editingOrder.amount}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busyOrder === editingOrder.id}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busyOrder === editingOrder.id ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {orders.length === 0 ? (
            <p className="text-sm text-gray-400">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">Client</th>
                    <th className="pb-2 pr-4">Product</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Odoo</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-400">{o.id}</td>
                      <td className="py-2 pr-4 font-medium">
                        {o.client?.name ?? `Client #${o.clientId}`}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {o.productName}
                      </td>
                      <td className="py-2 pr-4">
                        CFA{Number(o.amount).toFixed(2)}
                      </td>
                      <td className="py-2 pr-4">
                        <SyncBadge id={o.odooOrderId} />
                      </td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-3">
                          <ActionBtn
                            onClick={() => setEditingOrder(o)}
                            disabled={busyOrder === o.id}
                          >
                            Edit
                          </ActionBtn>
                          {!o.odooOrderId && (
                            <ActionBtn
                              onClick={() => handleRetryOrderSync(o.id)}
                              disabled={busyOrder === o.id}
                            >
                              Sync
                            </ActionBtn>
                          )}
                          <ActionBtn
                            onClick={() => handleDeleteOrder(o.id)}
                            disabled={busyOrder === o.id}
                            variant="danger"
                          >
                            Delete
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
