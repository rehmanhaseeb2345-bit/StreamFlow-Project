import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchUserPlaylists,
  createPlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
} from "../../api/playlists.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Spinner from "../ui/Spinner.jsx";
import InfiniteScrollSentinel from "../ui/InfiniteScrollSentinel.jsx";
import { patchDocInPages } from "../../lib/queryCache.js";
import { PLAYLIST_NAME_RULES } from "../../lib/constants.js";

const SaveToPlaylistModal = ({ videoId, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [modalError, setModalError] = useState("");

  // Keyed by videoId because hasVideo is specific to this video.
  const playlistsKey = ["playlists", user._id, { videoId }];

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: playlistsKey,
    queryFn: ({ pageParam }) =>
      fetchUserPlaylists(user._id, { page: pageParam, videoId }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
  });

  // Checkbox toggle: membership is known (hasVideo), flip optimistically.
  const toggleMutation = useMutation({
    mutationFn: (playlist) =>
      playlist.hasVideo
        ? removeVideoFromPlaylist(playlist._id, videoId)
        : addVideoToPlaylist(playlist._id, videoId),
    onMutate: async (playlist) => {
      await queryClient.cancelQueries({ queryKey: playlistsKey });
      const previous = queryClient.getQueryData(playlistsKey);
      queryClient.setQueryData(playlistsKey, (cached) =>
        patchDocInPages(cached, playlist._id, (p) => ({
          ...p,
          hasVideo: !p.hasVideo,
          videoCount: p.videoCount + (p.hasVideo ? -1 : 1),
        })),
      );
      return { previous };
    },
    onError: (err, _playlist, context) => {
      queryClient.setQueryData(playlistsKey, context.previous);
      setModalError(err.message);
    },
    onSettled: (_data, _err, playlist) => {
      // Detail page and channel-tab lists are stale now.
      queryClient.invalidateQueries({ queryKey: ["playlist", playlist._id] });
      queryClient.invalidateQueries({
        queryKey: ["playlists", user._id],
        exact: true,
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const playlist = await createPlaylist({ name: newName.trim() });
      await addVideoToPlaylist(playlist._id, videoId);
      return playlist;
    },
    onSuccess: () => {
      setNewName("");
      setModalError("");
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
    onError: (err) => setModalError(err.message),
  });

  const trimmedName = newName.trim();
  const canCreate =
    trimmedName.length >= PLAYLIST_NAME_RULES.minLength &&
    trimmedName.length <= PLAYLIST_NAME_RULES.maxLength &&
    !createMutation.isPending;

  const playlists = data?.pages.flatMap((page) => page.docs) ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label="Save to playlist"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Save to playlist</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {modalError && <p className="message-error">{modalError}</p>}

        {isLoading ? (
          <Spinner />
        ) : playlists.length === 0 ? (
          <p className="empty-state">No playlists yet — create one below.</p>
        ) : (
          <div className="modal-list">
            {playlists.map((playlist) => (
              <label key={playlist._id} className="modal-list-row">
                <span>
                  <input
                    type="checkbox"
                    checked={!!playlist.hasVideo}
                    onChange={() => toggleMutation.mutate(playlist)}
                  />{" "}
                  {playlist.name}
                </span>
                <span className="subscription-meta">
                  {playlist.videoCount}{" "}
                  {playlist.videoCount === 1 ? "video" : "videos"}
                </span>
              </label>
            ))}
            {isFetchingNextPage && <Spinner />}
            <InfiniteScrollSentinel
              onVisible={fetchNextPage}
              disabled={!hasNextPage || isFetchingNextPage}
            />
          </div>
        )}

        <form
          className="modal-create"
          onSubmit={(e) => {
            e.preventDefault();
            if (canCreate) createMutation.mutate();
          }}
        >
          <input
            type="text"
            placeholder="New playlist name"
            value={newName}
            maxLength={PLAYLIST_NAME_RULES.maxLength}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={!canCreate}>
            {createMutation.isPending ? "Creating..." : "Create & add"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SaveToPlaylistModal;
