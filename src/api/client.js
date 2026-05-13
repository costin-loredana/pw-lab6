const API_BASE = "http://localhost:3001";

async function apiFetch(path, options = {}, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    // Serverul nu e pornit sau CORS blocat
    throw new Error("Serverul nu raspunde. Verifica ca backend-ul ruleaza pe portul 3001.");
  }

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Raspuns invalid de la server (HTTP ${res.status})`);
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export { API_BASE, apiFetch };