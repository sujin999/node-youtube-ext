import { ChannelInfo, channelInfo, trend } from "../src";

const query = "방탄";

const start = async () => {
    const result = await trend(query, 20);

    console.dir(result.uniqueChannelIds.size);
    let channels: ChannelInfo[] = [];

    await Promise.all(
        Array.from(result.uniqueChannelIds).map(async (id) => {
            const query = "https://www.youtube.com/channel/" + id;
            const result = await channelInfo(query); // ChannelInfo
            channels.push(result);
        })
    );
    channels.sort((a, b) => {
        const subscribersA = parseSubscribers(a.subscribers.text);
        const subscribersB = parseSubscribers(b.subscribers.text);
        return subscribersB - subscribersA; // 내림차순으로 정렬
    });

    channels.forEach((channel) => {
        console.log(channel.name + ", " + channel.subscribers.pretty);
    });
};

function parseSubscribers(subscribersText: string): number {
    let num: number;
    if (subscribersText) {
        if (subscribersText.includes("만")) {
            num = parseFloat(subscribersText.replace(/[,만]/g, "")) * 10000;
        } else if (subscribersText.includes("천")) {
            num = parseFloat(subscribersText.replace(/[,천]/g, "")) * 1000;
        } else {
            num = parseInt(subscribersText.replace(/[,]/g, ""));
        }
        return num;
    } else {
        return 0;
    }
}

start();
