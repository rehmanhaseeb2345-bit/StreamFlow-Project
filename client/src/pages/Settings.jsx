import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  updateAccount,
  updateAvatar,
  updateCoverImage,
  changePassword,
} from "../api/users.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageTitle } from "../lib/usePageTitle.js";
import {
  FULLNAME_RULES,
  PASSWORD_RULES,
  EMAIL_PATTERN,
  ALLOWED_IMAGE_TYPES,
  validateImageFile,
} from "../lib/constants.js";

const ProfileSection = () => {
  const { user, setUser } = useAuth();
  const [successMessage, setSuccessMessage] = useState("");
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { fullname: user.fullname, email: user.email },
  });

  const onSubmit = async (values) => {
    setSuccessMessage("");
    setServerError("");
    try {
      const updated = await updateAccount({
        fullname: values.fullname.trim(),
        email: values.email.trim(),
      });
      setUser(updated);
      setSuccessMessage("Profile updated.");
    } catch (err) {
      if (err.statusCode === 409) {
        setError("email", { message: "Email already in use" });
      } else {
        setServerError(err.message);
      }
    }
  };

  return (
    <section className="settings-section">
      <h2>Profile</h2>
      {successMessage && <p className="message-success">{successMessage}</p>}
      {serverError && <p className="message-error">{serverError}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="form" noValidate>
        <div className="form-field">
          <label htmlFor="settings-fullname">Full name</label>
          <input
            id="settings-fullname"
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
          <label htmlFor="settings-email">Email</label>
          <input
            id="settings-email"
            type="email"
            {...register("email", {
              required: "Email is required",
              pattern: { value: EMAIL_PATTERN, message: "Invalid email address" },
            })}
          />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save profile"}
        </button>
      </form>
    </section>
  );
};

// One uploader used for both avatar and cover image.
const ImageUpdater = ({ label, currentUrl, request }) => {
  const { setUser } = useAuth();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleUpload = async () => {
    const fileError = !file ? "Choose a file first" : validateImageFile(file);
    setError(fileError);
    if (fileError) return;

    setIsPending(true);
    setSuccessMessage("");
    try {
      const updated = await request(file);
      setUser(updated);
      setFile(null);
      setSuccessMessage(`${label} updated.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="form-field">
      <label>{label}</label>
      <img
        src={file ? URL.createObjectURL(file) : currentUrl}
        alt={`${label} preview`}
        className="image-preview"
      />
      <input
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          setFile(picked);
          setError(validateImageFile(picked));
          setSuccessMessage("");
        }}
      />
      {error && <p className="field-error">{error}</p>}
      {successMessage && <p className="message-success">{successMessage}</p>}
      <div>
        <button type="button" onClick={handleUpload} disabled={isPending || !file}>
          {isPending ? "Uploading..." : `Update ${label.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
};

const ImagesSection = () => {
  const { user } = useAuth();

  return (
    <section className="settings-section">
      <h2>Images</h2>
      <ImageUpdater
        label="Avatar"
        currentUrl={user.avatar?.url}
        request={(file) => {
          const formData = new FormData();
          formData.append("avatar", file);
          return updateAvatar(formData);
        }}
      />
      <ImageUpdater
        label="Cover image"
        currentUrl={user.coverImage?.url}
        request={(file) => {
          const formData = new FormData();
          formData.append("coverImage", file);
          return updateCoverImage(formData);
        }}
      />
    </section>
  );
};

const PasswordSection = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (values) => {
    setServerError("");
    try {
      await changePassword(values);
      // The backend revoked the refresh token; treat this as a forced logout.
      await logout();
      navigate("/login", {
        state: { message: "Password changed — please sign in again." },
      });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <section className="settings-section">
      <h2>Change password</h2>
      <p className="subscription-meta">
        You will be signed out and asked to log in again.
      </p>
      {serverError && <p className="message-error">{serverError}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="form" noValidate>
        <div className="form-field">
          <label htmlFor="old-password">Current password</label>
          <input
            id="old-password"
            type="password"
            autoComplete="current-password"
            {...register("oldPassword", {
              required: "Current password is required",
            })}
          />
          {errors.oldPassword && (
            <p className="field-error">{errors.oldPassword.message}</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...register("newPassword", {
              required: "New password is required",
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
          {errors.newPassword && (
            <p className="field-error">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword", {
              required: "Please confirm the new password",
              validate: (value) =>
                value === watch("newPassword") || "Passwords do not match",
            })}
          />
          {errors.confirmPassword && (
            <p className="field-error">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Changing..." : "Change password"}
        </button>
      </form>
    </section>
  );
};

const Settings = () => {
  usePageTitle("Settings");

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <ProfileSection />
      <ImagesSection />
      <PasswordSection />
    </div>
  );
};

export default Settings;
