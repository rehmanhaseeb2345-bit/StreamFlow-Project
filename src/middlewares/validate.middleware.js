import { z } from "zod";
import fs from "fs";
import { ApiError } from "../utils/ApiError.js";

const cleanupRequestFiles = (req) => {
  if (req.files) {
    Object.values(req.files)
      .flat()
      .forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
  }
};

const validate = (schema) => (req, res, next) => {
  schema
    .parseAsync(req.body)
    .then((parseBody) => {
      req.body = parseBody;
      next();
    })
    .catch((err) => {
      cleanupRequestFiles(req);
      if (err instanceof z.ZodError) {
        const errorMessages = err.issues.map((e) => e.message).join(", ");
        next(new ApiError(400, `Validation Failed: ${errorMessages}`));
      } else {
        next(err);
      }
    });
};

export const validateMiddleware = validate;
