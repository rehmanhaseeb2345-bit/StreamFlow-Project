import { api } from "./client.js";

export const fetchMe = async () => {
  const res = await api.get("/users/me");
  return res.data.data;
};

// payload: { email | username, password }
export const loginRequest = async (payload) => {
  const res = await api.post("/users/login", payload);
  return res.data.data.user;
};

// formData: multipart with fullname, username, email, password, avatar (required), coverImage (optional).
// Registration does NOT log the user in — the backend sets no cookies here.
export const registerRequest = async (formData) => {
  const res = await api.post("/users/register", formData);
  return res.data.data;
};

export const logoutRequest = async () => {
  const res = await api.post("/users/logout");
  return res.data;
};

export const fetchHealthcheck = async () => {
  const res = await api.get("/healthcheck");
  return res.data.data;
};
