const unified = require("unified");
const remarkHtml = require("remark-html");
const rehypePrism = require("@mapbox/rehype-prism");
const rehypeParse = require("rehype-parse");
const rehypeStringify = require("rehype-stringify");

const remarkProcessor = unified()
  .use(remarkHtml)
  .use(rehypePrism, { ignoreMissing: true });

const prismProcessor = unified()
  .data("settings", { fragment: true })
  .use(rehypeParse)
  .use(rehypePrism, { ignoreMissing: true })
  .use(rehypeStringify);

module.exports = (mdast) =>
  prismProcessor.processSync(remarkProcessor.stringify(mdast)).toString();
