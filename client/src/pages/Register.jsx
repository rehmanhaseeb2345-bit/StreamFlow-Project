import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { registerRequest } from "../api/auth.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import {
  USERNAME_RULES,
  FULLNAME_RULES,
  PASSWORD_RULES,
  EMAIL_PATTERN,
  ALLOWED_IMAGE_TYPES,
  validateImageFile,
} from "../lib/constants.js";

// Small controlled file input with preview + validation against backend limits.
const ImagePicker = ({ label, file, onChange, error, required }) => {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="form-field">
      <label>
        {label} {required && <span aria-hidden="true">*</span>}
      </label>
      <input
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {previewUrl && (
        <img src={previewUrl} alt={`${label} preview`} className="image-preview" />
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
};

const Register = () => {
  usePageTitle("Register");
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [fileErrors, setFileErrors] = useState({});

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm();

  const pickAvatar = (file) => {
    setAvatar(file);
    setFileErrors((prev) => ({ ...prev, avatar: validateImageFile(file) }));
  };

  const pickCover = (file) => {
    setCoverImage(file);
    setFileErrors((prev) => ({ ...prev, coverImage: validateImageFile(file) }));
  };

  const onSubmit = async (values) => {
    setServerError("");

    // Files are outside react-hook-form; validate them here so a bad file
    // never reaches the server (which would reject after the full upload).
    const avatarError = !avatar ? "Avatar is required" : validateImageFile(avatar);
    const coverError = validateImageFile(coverImage);
    setFileErrors({ avatar: avatarError, coverImage: coverError });
    if (avatarError || coverError) return;

    const formData = new FormData();
    formData.append("fullname", values.fullname.trim());
    formData.append("username", values.username.trim());
    formData.append("email", values.email.trim());
    formData.append("password", values.password);
    formData.append("avatar", avatar);
    if (coverImage) formData.append("coverImage", coverImage);

    try {
      await registerRequest(formData);
      // Registration does not log you in (backend sets no cookies) — go to login.
      navigate("/login", {
        state: { message: "Account created — please log in." },
      });
    } catch (err) {
      if (err.statusCode === 409) {
        // Backend can't tell us which one collided; flag both fields.
        setError("username", { message: "Email or username already in use" });
        setError("email", { message: "Email or username already in use" });
      } else {
        setServerError(err.message);
      }
    }
  };

  return (
    <div className="auth-page">
      <h1>Register</h1>

      {serverError && <p className="message-error">{serverError}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="form" noValidate>
        <div className="form-field">
          <label htmlFor="fullname">Full name</label>
          <input
            id="fullname"
            type="text"
            {...register("fullname", {
              required: "Full name is required",
              minLength: {
                value: FULLNAME_RULES.minLength,
                message: FULLNAME_RULES.message,
              },
              maxLength: {
                value: FULLNAME_RULES.maxLength,
                message: FULLNAME_RULES.message,
              },
            })}
          />
          {errors.fullname && (
            <p className="field-error">{errors.fullname.message}</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            {...register("username", {
              required: "Username is required",
              minLength: {
                value: USERNAME_RULES.minLength,
                message: USERNAME_RULES.message,
              },
              maxLength: {
                value: USERNAME_RULES.maxLength,
                message: USERNAME_RULES.message,
              },
              pattern: {
                value: USERNAME_RULES.pattern,
                message: USERNAME_RULES.message,
              },
            })}
          />
          {errors.username && (
            <p className="field-error">{errors.username.message}</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: EMAIL_PATTERN,
                message: "Invalid email address",
              },
            })}
          />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: PASSWORD_RULES.minLength,
                message: PASSWORD_RULES.message,
              },
              maxLength: {
                value: PASSWORD_RULES.maxLength,
                message: PASSWORD_RULES.message,
              },
              pattern: {
                value: PASSWORD_RULES.pattern,
                message: PASSWORD_RULES.message,
              },
            })}
          />
          {errors.password && (
            <p className="field-error">{errors.password.message}</p>
          )}
        </div>

        <ImagePicker
          label="Avatar"
          required
          file={avatar}
          onChange={pickAvatar}
          error={fileErrors.avatar}
        />

        <ImagePicker
          label="Cover image"
          file={coverImage}
          onChange={pickCover}
          error={fileErrors.coverImage}
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};

export default Register;
