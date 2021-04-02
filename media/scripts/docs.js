const fs = require("fs");
const path = require("path");
const pkgjson = require("../../package.json");

const URL = pkgjson.homepage;

const start = async () => {
    const cnamedir = path.resolve(__dirname, "..", "..", "docs", "CNAME");
    fs.writeFileSync(cnamedir, URL);
    console.log(`Wrote CNAME file to ${cnamedir} pointing to '${URL}'`);
}

start();
