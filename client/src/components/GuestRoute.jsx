import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "./ui/Spinner.jsx";

// Wraps login/register: already-authenticated users go home instead.
const GuestRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner fullPage />;

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default GuestRoute;
