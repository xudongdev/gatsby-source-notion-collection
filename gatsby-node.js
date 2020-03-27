/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const path = require("path");
const { Promise } = require("bluebird");
const fs = require("fs-extra");
const Notion = require("./lib/Notion");
const packageVersion = require("./package").version;

exports.sourceNodes = async (
  { actions: { createNode }, createContentDigest },
  { collectionId, collectionViewId, concurrency = 5, token, type = "Post" }
) => {
  const notion = new Notion({ token });

  const { pages } = await notion.getCollection(collectionId, collectionViewId);

  await Promise.map(
    pages,
    async ({ id, version }) => {
      let page;
      const cachePath = path.join(process.cwd(), `.cache/notion/${id}.json`);

      if (await fs.exists(cachePath)) {
        const cache = require(cachePath);

        if (
          version === cache.version &&
          packageVersion === cache.packageVersion
        ) {
          page = cache;
        }
      }

      page = await notion.getPage(id);

      await fs.outputFile(cachePath, JSON.stringify(page, null, 2));

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
