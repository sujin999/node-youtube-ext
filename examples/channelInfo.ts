import { channelInfo } from "../src";

//const query = "https://www.youtube.com/channel/UC_aEa8K-EOJ3D6gOs7HcyNg";
const query = "https://www.youtube.com/channel/UCszFjh7CEfwDb7UUGb4RzCQ";

const start = async () => {
    const result = await channelInfo(query);
    console.log(JSON.stringify(result, null, 4));
};

start();
