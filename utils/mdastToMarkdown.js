const unified = require("unified");
const remarkStringify = require("remark-stringify");

const processor = unified().use(remarkStringify);

module.exports = (mdast) => processor.stringify(mdast);
