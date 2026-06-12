import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginRequest } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageTitle } from "../lib/usePageTitle.js";

const Login = () => {
  usePageTitle("Login");
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const successMessage = location.state?.message;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ identifier, password }) => {
    setServerError("");
    // The backend accepts either email or username; an "@" means email.
    const payload = identifier.includes("@")
      ? { email: identifier.trim(), password }
      : { username: identifier.trim(), password };

    try {
      const user = await loginRequest(payload);
      setUser(user);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <h1>Login</h1>

      {successMessage && <p className="message-success">{successMessage}</p>}
      {serverError && <p className="message-error">{serverError}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="form" noValidate>
        <div className="form-field">
          <label htmlFor="identifier">Username or email</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            {...register("identifier", {
              required: "Username or email is required",
            })}
          />
          {errors.identifier && (
            <p className="field-error">{errors.identifier.message}</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password", { required: "Password is required" })}
          />
          {errors.password && (
            <p className="field-error">{errors.password.message}</p>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      <p>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
};

export default Login;
