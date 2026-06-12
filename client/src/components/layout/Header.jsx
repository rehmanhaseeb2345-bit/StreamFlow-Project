import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    const query = search.trim();
    if (query) {
      navigate(`/results?query=${encodeURIComponent(query)}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        StreamYT
      </Link>

      <form className="header-search" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <nav className="header-nav">
        {user ? (
          <>
            <Link to="/studio/upload">Upload</Link>
            <Link to={`/channel/${user.username}`} className="header-user">
              <img
                src={user.avatar?.url}
                alt={user.fullname}
                className="avatar avatar-sm"
              />
              <span>{user.fullname}</span>
            </Link>
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
};

export default Header;
