import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideoById, updateVideo } from "../../api/videos.js";
import Spinner from "../../components/ui/Spinner.jsx";
import { usePageTitle } from "../../lib/usePageTitle.js";
import {
  VIDEO_TITLE_RULES,
  VIDEO_DESCRIPTION_RULES,
  ALLOWED_IMAGE_TYPES,
  validateImageFile,
} from "../../lib/constants.js";

const EditVideo = () => {
  usePageTitle("Edit video");
  const { videoId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailError, setThumbnailError] = useState(null);
  const [serverError, setServerError] = useState("");

  // Owner views don't increment the view count, and only the owner can save,
  // so reusing the public fetch here is safe.
  const {
    data: video,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => fetchVideoById(videoId),
    staleTime: Infinity,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ values: video && { title: video.title, description: video.description } });

  const onSubmit = async (values) => {
    setServerError("");

    const fileError = validateImageFile(thumbnail);
    setThumbnailError(fileError);
    if (fileError) return;

    // The PATCH route always runs multer, so always send FormData.
    const formData = new FormData();
    formData.append("title", values.title.trim());
    formData.append("description", values.description.trim());
    if (thumbnail) formData.append("thumbnail", thumbnail);

    try {
      await updateVideo(videoId, formData);
      queryClient.removeQueries({ queryKey: ["video", videoId] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["studio"] });
      navigate("/studio", { state: { message: "Video updated." } });
    } catch (err) {
      setServerError(err.message);
    }
  };

  if (isLoading) return <Spinner fullPage />;

  if (isError) {
    return (
      <div className="not-found">
        <h1>{error.statusCode === 404 ? "Video not found" : "Error"}</h1>
        <p>{error.message}</p>
        <Link to="/studio">Back to studio</Link>
      </div>
    );
  }

  return (
    <div className="studio-page">
      <h1>Edit video</h1>

      {serverError && <p className="message-error">{serverError}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="form" noValidate>
        <div className="form-field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
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

        <div className="form-field">
          <label>Thumbnail (leave empty to keep the current one)</label>
          <img
            src={thumbnail ? URL.createObjectURL(thumbnail) : video.thumbnail?.url}
            alt="Thumbnail preview"
            className="image-preview"
          />
          <input
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setThumbnail(file);
              setThumbnailError(validateImageFile(file));
            }}
          />
          {thumbnailError && <p className="field-error">{thumbnailError}</p>}
        </div>

        <div className="form-row">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
          <Link to="/studio">Cancel</Link>
        </div>
      </form>
    </div>
  );
};

export default EditVideo;
