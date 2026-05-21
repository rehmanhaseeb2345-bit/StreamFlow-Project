import dotenv from "dotenv";
import connectToDB from "./src/db/db.js";

dotenv.config({
  path: "./env",
});

PORT = process.env.PORT || 3000;

connectToDB()
  .then(() => {
    app.listen((PORT) => {
      console.log(`Server is running at Port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGO DB connection Failed", err);
  });
