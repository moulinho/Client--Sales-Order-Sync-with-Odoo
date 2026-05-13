import Dashboard from "./components/Dashboard";

const API = process.env.API_URL ?? "http://localhost:3001";

async function fetchClients() {
  try {
    const res = await fetch(`${API}/clients`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchOrders() {
  try {
    const res = await fetch(`${API}/orders`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const [clients, orders] = await Promise.all([fetchClients(), fetchOrders()]);
  return <Dashboard initialClients={clients} initialOrders={orders} />;
}
