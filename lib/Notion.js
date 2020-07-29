const axios = require("axios");
const Collection = require("./Collection");

module.exports = class Notion {
  constructor({ token, properties = {} }) {
    this.properties = properties;
    this.request = axios.create({
      baseURL: "https://www.notion.so/api/v3",
      headers: { cookie: `token_v2=${token}` },
    });
  }

  async getCollection(collectionId, collectionViewId) {
    return new Collection(this, collectionId, collectionViewId);
  }
};
