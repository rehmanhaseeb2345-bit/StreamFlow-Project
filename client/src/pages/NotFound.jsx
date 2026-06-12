import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>This page does not exist.</p>
      <Link to="/">Go home</Link>
    </div>
  );
};

export default NotFound;
