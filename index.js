import "dotenv/config";
import dns from "node:dns";
import fs from "fs";
import app from "./src/app.js";
import connectToDB from "./src/db/db.js";

// Some local/network DNS resolvers fail to resolve the MongoDB Atlas SRV
// record, which breaks the initial DB connection. Force public resolvers
// (Google, Cloudflare) so SRV lookups succeed regardless of host DNS config.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

fs.mkdirSync("./temp/uploads", { recursive: true });

const REQUIRED_ENV = [
  "MONGODB_URI",
  "CORS_ORIGIN",
  "ACCESS_TOKEN_SECRET",
  "ACCESS_TOKEN_EXPIRY",
  "REFRESH_TOKEN_SECRET",
  "REFRESH_TOKEN_EXPIRY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(
    `[STARTUP] Missing required environment variables: ${missingEnv.join(", ")}`,
  );
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

connectToDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running at Port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGO DB connection Failed", err);
  });
