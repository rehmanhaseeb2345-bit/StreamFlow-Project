import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { publishVideo } from "../../api/videos.js";
import { usePageTitle } from "../../lib/usePageTitle.js";
import {
  VIDEO_TITLE_RULES,
  VIDEO_DESCRIPTION_RULES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_IMAGE_TYPES,
  validateVideoFile,
  validateImageFile,
} from "../../lib/constants.js";

const Upload = () => {
  usePageTitle("Upload video");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [fileErrors, setFileErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [progress, setProgress] = useState(null); // null = not uploading

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const isUploading = progress !== null;

  // A closed tab kills the upload; warn while one is in flight.
  useEffect(() => {
    if (!isUploading) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isUploading]);

  const onSubmit = async (values) => {
    setServerError("");

    // Validate files before transferring up to 100MB only to be rejected.
    const videoError = !videoFile
      ? "Video file is required"
      : validateVideoFile(videoFile);
    const thumbError = !thumbnail
      ? "Thumbnail is required"
      : validateImageFile(thumbnail);
    setFileErrors({ videoFile: videoError, thumbnail: thumbError });
    if (videoError || thumbError) return;

    const formData = new FormData();
    formData.append("title", values.title.trim());
    formData.append("description", values.description.trim());
    formData.append("videoFile", videoFile);
    formData.append("thumbnail", thumbnail);

    setProgress(0);
    try {
      const video = await publishVideo(formData, setProgress);
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["studio"] });
      navigate("/studio", {
        state: { message: `"${video.title}" published successfully.` },
      });
    } catch (err) {
      setServerError(err.message);
      setProgress(null);
    }
  };

  return (
    <div className="studio-page">
      <h1>Upload video</h1>

      {serverError && <p className="message-error">{serverError}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="form" noValidate>
        <div className="form-field">
          <label>
            Video file <span aria-hidden="true">*</span> (MP4, WebM, OGG, MOV,
            MKV — max 100MB)
          </label>
          <input
            type="file"
            accept={ALLOWED_VIDEO_TYPES.join(",")}
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setVideoFile(file);
              setFileErrors((prev) => ({
                ...prev,
                videoFile: validateVideoFile(file),
              }));
            }}
          />
          {videoFile && (
            <p className="file-info">
              {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
            </p>
          )}
          {fileErrors.videoFile && (
            <p className="field-error">{fileErrors.videoFile}</p>
          )}
        </div>

        <div className="form-field">
          <label>
            Thumbnail <span aria-hidden="true">*</span> (JPEG, PNG, WebP, GIF —
            max 5MB)
          </label>
          <input
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setThumbnail(file);
              setFileErrors((prev) => ({
                ...prev,
                thumbnail: validateImageFile(file),
              }));
            }}
          />
          {fileErrors.thumbnail && (
            <p className="field-error">{fileErrors.thumbnail}</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            disabled={isUploading}
            {...register("title", {
              required: "Title is required",
              minLength: {
                value: VIDEO_TITLE_RULES.minLength,
                message: `Title must be at least ${VIDEO_TITLE_RULES.minLength} characters`,
              },
              maxLength: {
                value: VIDEO_TITLE_RULES.maxLength,
                message: `Title cannot exceed ${VIDEO_TITLE_RULES.maxLength} characters`,
              },
            })}
          />
          {errors.title && <p className="field-error">{errors.title.message}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={5}
            disabled={isUploading}
            {...register("description", {
              required: "Description is required",
              maxLength: {
                value: VIDEO_DESCRIPTION_RULES.maxLength,
                message: `Description cannot exceed ${VIDEO_DESCRIPTION_RULES.maxLength} characters`,
              },
            })}
          />
          {errors.description && (
            <p className="field-error">{errors.description.message}</p>
          )}
        </div>

        {isUploading && (
          <div className="upload-progress">
            <div
              className="upload-progress-bar"
              style={{ width: `${progress}%` }}
            />
            <span>
              {progress < 100
                ? `Uploading... ${progress}%`
                : "Processing on server..."}
            </span>
          </div>
        )}

        <button type="submit" disabled={isUploading}>
          {isUploading ? "Uploading..." : "Publish"}
        </button>
      </form>
    </div>
  );
};

export default Upload;
