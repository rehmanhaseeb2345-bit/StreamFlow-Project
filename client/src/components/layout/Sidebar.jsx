import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const Sidebar = () => {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <NavLink to="/" end>
          Home
        </NavLink>
        {user && (
          <>
            <NavLink to="/liked">Liked videos</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/subscriptions">Subscriptions</NavLink>
            <NavLink to={`/channel/${user.username}`}>My channel</NavLink>
            <NavLink to="/studio">Studio</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
