import { Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Layout from "./components/layout/Layout.jsx";
import GuestRoute from "./components/GuestRoute.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import Results from "./pages/Results.jsx";
import Watch from "./pages/Watch.jsx";
import Channel from "./pages/Channel.jsx";
import Playlist from "./pages/Playlist.jsx";
import Liked from "./pages/Liked.jsx";
import History from "./pages/History.jsx";
import Settings from "./pages/Settings.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";
import Studio from "./pages/studio/Studio.jsx";
import Upload from "./pages/studio/Upload.jsx";
import EditVideo from "./pages/studio/EditVideo.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import NotFound from "./pages/NotFound.jsx";

const App = () => {
  return (
    <ErrorBoundary>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/results" element={<Results />} />
        <Route path="/watch/:videoId" element={<Watch />} />
        <Route path="/channel/:username" element={<Channel />} />
        <Route path="/playlist/:playlistId" element={<Playlist />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/liked" element={<Liked />} />
          <Route path="/history" element={<History />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/studio/upload" element={<Upload />} />
          <Route path="/studio/edit/:videoId" element={<EditVideo />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
