import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import mongoose from "mongoose";
import { ApiResponse } from "./utils/ApiResponse.js";
import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

const app = express();

// Behind a reverse proxy (e.g. Nginx, load balancer), trust the first hop so
// req.ip / req.secure reflect the real client (used by rate limiting and
// login logging). Disabled by default for direct/local deployments.
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

app.use(helmet());
app.disable("x-powered-by");

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.static("public"));
app.use(cookieParser());

app.get("/api/v1/healthcheck", (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const statusCode = dbState === "connected" ? 200 : 503;

  res
    .status(statusCode)
    .json(new ApiResponse(statusCode, { db: dbState }, "OK"));
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlists", playlistRouter);
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.message,
      errors: [],
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    statusCode,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
  });
});

export default app;
