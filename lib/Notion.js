/* eslint-disable class-methods-use-this */
/* eslint-disable prefer-destructuring */
const _ = require("lodash");
const axios = require("axios");
const unified = require("unified");
const remarkHtml = require("remark-html");
const rehypePrism = require("@mapbox/rehype-prism");
const remarkStringify = require("remark-stringify");

const packageVersion = require("../package").version;

module.exports = class Notion {
  constructor({ token }) {
    this.request = axios.create({
      baseURL: "https://www.notion.so/api/v3",
      headers: { cookie: `token_v2=${token}` },
    });
  }

  convertBlock(blockMap, blockId) {
    const block = blockMap[blockId];
    const node = {};

    const children = [
      ...(block.value.properties.title
        ? this.convertTitle(block.value.properties.title)
        : []),
      ...(block.value.content
        ? this.convertBlocks(blockMap, block.value.content)
        : []),
    ];

    switch (block.value.type) {
      case "code":
        node.type = "code";
        node.lang = block.value.properties.language[0][0].toLowerCase();
        node.value = block.value.properties.title[0][0];
        return node;
      case "image":
        node.type = "image";
        node.url = block.value.properties.source[0][0];
        return node;
      case "numbered_list":
      case "bulleted_list":
      case "to_do":
        node.type = "list";
        node.ordered = block.value.type === "numbered_list";
        node.children = [
          {
            type: "listItem",
            checked:
              block.value.type === "to_do"
                ? !!block.value.properties.checked
                : null,
            children,
          },
        ];
        return node;
      case "header":
        node.type = "heading";
        node.depth = 1;
        break;
      case "sub_header":
        node.type = "heading";
        node.depth = 2;
        break;
      case "sub_sub_header":
        node.type = "heading";
        node.depth = 3;
        break;
      case "quote":
        node.type = "blockquote";
        break;
      case "text":
        node.type = "paragraph";
        break;
      default:
        return null;
    }

    return {
      ...node,
      ...(children ? { children } : {}),
    };
  }

  convertBlocks(blockMap, blockIds) {
    return blockIds
      .map((blockId) => this.convertBlock(blockMap, blockId))
      .filter((block) => block)
      .reduce((result, node, index, nodes) => {
        const prevNode = index > 0 ? nodes[index - 1] : null;

        if (
          prevNode &&
          prevNode.type === "list" &&
          node.type === "list" &&
          node.ordered === prevNode.ordered &&
          (node.children[0].checked === null) ===
            (prevNode.children[0].checked === null)
        ) {
          // eslint-disable-next-line no-param-reassign
          result[result.length - 1] = {
            ...result[result.length - 1],
            children: [...result[result.length - 1].children, ...node.children],
          };
        } else {
          result.push(node);
        }

        return result;
      }, []);
  }

  convertTitle(title) {
    return title.map(([value]) => {
      return {
        type: "text",
        value,
      };
    });
  }

  async getCollection(collectionId, collectionViewId) {
    const { data } = await this.request.post("/queryCollection", {
      collectionId,
      collectionViewId,
      loader: {
        type: "table",
        limit: 10000,
      },
    });

    return {
      pages: data.result.blockIds
        .filter(
          (blockId) => data.recordMap.block[blockId].value.type === "page"
        )
        .map((blockId) => {
          const block = data.recordMap.block[blockId];

          const { id } = block.value;
          const { version } = block.value;
          const title = (_.get(block, "value.properties.title") || []).join("");
          const createdAt = new Date(block.value.created_time);
          const updatedAt = new Date(block.value.last_edited_time);

          return {
            id,
            version,
            title,
            createdAt,
            updatedAt,
          };
        }),
    };
  }

  async getPage(pageId) {
    const { data } = await this.request.post("/loadPageChunk", {
      pageId,
      limit: 10000,
      cursor: {
        stack: [
          [
            {
              table: "block",
              id: pageId,
              index: 0,
            },
          ],
        ],
      },
      chunkNumber: 0,
      verticalColumns: false,
    });

    const pageBlock = data.recordMap.block[pageId];

    const { id } = pageBlock.value;
    const { version } = pageBlock.value;
    const title = (_.get(pageBlock, "value.properties.title") || []).join("");
    const createdAt = new Date(pageBlock.value.created_time);
    const updatedAt = new Date(pageBlock.value.last_edited_time);

    const mdast = {
      type: "root",
      children: this.convertBlocks(
        data.recordMap.block,
        (pageBlock.value.content || []).filter(
          (item) => data.recordMap.block[item].value.properties
        )
      ),
    };

    const markdown = unified().use(remarkStringify).stringify(mdast);

    const html = unified().use(remarkHtml).use(rehypePrism).stringify(mdast);

    return {
      createdAt,
      html,
      id,
      markdown,
      packageVersion,
      title,
      updatedAt,
      version,
    };
  }
};
