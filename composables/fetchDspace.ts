
export const fetchDspaceItemLogs = async (email: string) => {
  // Without an email the filter would be dropped and the first record of any
  // user returned — bail out instead.
  if (!email) return [];

    const { getItems } = useDirectusItems();
  const items = await getItems({
    collection: "log_dspace_items",
    params: {
      filter: {
        email: email,
      },
      limit: 1,
    },
  }).catch(() => []);
  return items;
};
