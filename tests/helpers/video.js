import { app, request } from "./auth.js";
import { validMp4, validPng } from "../fixtures/files.js";

let counter = 0;

export const publishVideo = async (cookies, overrides = {}) => {
  counter += 1;
  const body = {
    title: overrides.title ?? `Test Video ${counter}`,
    description: overrides.description ?? `Description for video ${counter}`,
  };

  return request(app)
    .post("/api/v1/videos")
    .set("Cookie", cookies)
    .field("title", body.title)
    .field("description", body.description)
    .attach("videoFile", validMp4, { filename: "video.mp4", contentType: "video/mp4" })
    .attach("thumbnail", validPng, { filename: "thumb.png", contentType: "image/png" });
};
