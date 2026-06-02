const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT || 30000);

export default { API_BASE_URL, API_TIMEOUT };
