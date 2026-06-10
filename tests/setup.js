import { beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "fs";

process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret";
process.env.ACCESS_TOKEN_EXPIRY = "15m";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-token-secret";
process.env.REFRESH_TOKEN_EXPIRY = "7d";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-api-key";
process.env.CLOUDINARY_API_SECRET = "test-api-secret";

fs.mkdirSync("./temp/uploads", { recursive: true });

// Cloudinary is an external service: never hit the network in tests. The
// mock mimics the real upload util's contract (deletes the local temp file
// and returns {url, public_id}, or null on missing input).
vi.mock("../src/utils/cloudinary.js", () => {
  let counter = 0;
  return {
    cloudinary: {},
    uploadOnCloudinary: vi.fn(async (localFilePath) => {
      if (!localFilePath) return null;
      counter += 1;
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      return {
        url: `https://res.cloudinary.com/test-cloud/mock-${counter}`,
        public_id: `mock_public_id_${counter}`,
        duration: 123.45,
      };
    }),
    deleteFromCloudinary: vi.fn(async () => ({ result: "ok" })),
  };
});

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "streamyt-test" });
}, 120000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});
