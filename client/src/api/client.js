import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

// Every backend error has the shape { success, statusCode, message, errors }.
// Normalize to a plain object so UI code can rely on err.statusCode / err.message.
const normalizeError = (error) => {
  const data = error.response?.data;
  return {
    statusCode: error.response?.status ?? 0,
    message:
      data?.message ||
      (error.response ? "Something went wrong" : "Network error — is the server running?"),
  };
};

// Paths where a 401 means "bad credentials / bad token", not "expired access
// token" — never trigger a refresh for these.
const AUTH_PATHS = ["/users/login", "/users/register", "/users/refresh-token"];

// The backend rotates refresh tokens and treats reuse of an old one as theft
// (revokes the whole session). If two requests 401 at the same time they MUST
// share one refresh call, otherwise the second refresh logs the user out.
let refreshPromise = null;

const refreshTokens = () => {
  if (!refreshPromise) {
    refreshPromise = api.post("/users/refresh-token").finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthPath = AUTH_PATHS.some((path) => original?.url?.includes(path));

    if (status === 401 && original && !original._retried && !isAuthPath) {
      original._retried = true;
      try {
        await refreshTokens();
        return api(original);
      } catch {
        // Refresh failed: session is over. Fall through to reject with the
        // original 401; AuthContext/route guards handle the redirect.
      }
    }

    return Promise.reject(normalizeError(error));
  },
);
