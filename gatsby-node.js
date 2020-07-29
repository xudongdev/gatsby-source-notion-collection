/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const { Promise } = require("bluebird");
const Notion = require("./lib/Notion");
const packageVersion = require("./package").version;

exports.sourceNodes = async (
  { actions: { createNode }, cache, createContentDigest },
  {
    collectionId,
    collectionViewId,
    concurrency = 10,
    token,
    type = "Post",
    properties = {},
  }
) => {
  const notion = new Notion({ token, properties });

  const collection = await notion.getCollection(collectionId, collectionViewId);
  const pages = await collection.getPages();

  await Promise.map(
    pages,
    async ({ id, version }) => {
      let page = await cache.get(id);

      if (
        !page ||
        page.version !== version ||
        page.packageVersion !== packageVersion
      ) {
        page = await collection.getPage(id);
      }

      createNode({
        ...page,
        internal: {
          type,
          mediaType: `text/html`,
          contentDigest: createContentDigest(page),
        },
      });
    },
    { concurrency }
  );
};
