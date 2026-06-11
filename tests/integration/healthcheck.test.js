import { describe, it, expect } from "vitest";
import { app, request } from "../helpers/auth.js";

describe("GET /api/v1/healthcheck", () => {
  it("reports the service and database as up", async () => {
    const res = await request(app).get("/api/v1/healthcheck");

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.db).toBe("connected");
  });
});
