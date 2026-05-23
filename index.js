import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import app from "./src/app.js";
import dotenv from "dotenv";
import connectToDB from "./src/db/db.js";

dotenv.config({
  path: "./.env",
});

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
