const { channelInfo } = require("../dist");

const query = "https://www.youtube.com/channel/UC_aEa8K-EOJ3D6gOs7HcyNg";

const main = async () => {
    try {
        const info = await channelInfo(query);

        console.log(
            `Name: ${info.name}`,
            `\nDescription: ${info.description}`,
            `\nURL: ${info.url}`,
            `\nSubscribers: ${info.subscribers.pretty}`,
            "\n"
        );
    } catch (err) {
        console.log(`No result were found for ${query} (${err})`);
    }
}

module.exports = main;

if (process.env.NODE_ENV !== "test") main();