// Applies an updater to one document inside a useInfiniteQuery cache
// ({ pages: [{ docs: [...] }] }) without refetching. Used for optimistic
// like toggles and inline edits.
export const patchDocInPages = (data, docId, updater) => {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      docs: page.docs.map((doc) => (doc._id === docId ? updater(doc) : doc)),
    })),
  };
};
