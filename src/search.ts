import { request } from "undici";
import { cookieJar } from "./cookies";
import {
    UndiciRequestOptions,
    assertUndiciOkResponse,
    constants,
    mergeObj,
} from "./utils";

export interface SearchOptions {
    requestOptions?: UndiciRequestOptions;
    filterType?: keyof typeof constants.urls.search.filters;
}

export interface SearchVideo {
    title: string;
    id: string;
    url: string;
    channel: {
        name: string;
        id: string;
        url: string;
    };
    duration: {
        text: string;
        pretty: string;
    };
    published: {
        pretty: string;
    };
    views: {
        text: string;
        pretty: string;
        prettyLong: string;
    };
    thumbnails: {
        url: string;
        width: number;
        height: number;
    }[];
}

export interface SearchChannel {
    name: string;
    id: string;
    url: string;
    subscribers: {
        text: string;
        pretty: string;
    };
    icons: {
        url: string;
        width: number;
        height: number;
    }[];
    badges: string[];
}

export interface SearchPlaylist {
    name: string;
    id: string;
    url: string;
    thumbnails: {
        url: string;
        width: number;
        height: number;
    }[];
    videoCount: string;
    published: {
        pretty?: string;
    };
}

/**
 * Search for videos, channels, playlists, etc...
 */
export const search = async (
    terms: string,
    limit: number = 0,
    options: SearchOptions = {}
) => {
    if (typeof terms !== "string") {
        throw new Error(constants.errors.type("terms", "string", typeof terms));
    }
    if (typeof options !== "object") {
        throw new Error(
            constants.errors.type("options", "object", typeof options)
        );
    }

    options = mergeObj(
        {
            requestOptions: {
                headers: {
                    "User-Agent": constants.requestOptions.userAgent,
                    Cookie: cookieJar.cookieHeaderValue(),
                },
                maxRedirections: constants.requestOptions.maxRedirections,
            },
        },
        options
    );

    let url = constants.urls.search.base(terms);
    if (
        options.filterType &&
        constants.urls.search.filters[options.filterType]
    ) {
        url += constants.urls.search.filters[options.filterType];
    }

    const result: {
        videos: SearchVideo[];
        channels: SearchChannel[];
        playlists: SearchPlaylist[];
        uniqueChannelIds: Set<string>;
    } = {
        videos: [],
        channels: [],
        playlists: [],
        uniqueChannelIds: new Set<string>(),
    };

    let continuationToken: string | null = null;

    // 무한 루프 방지용 변수 추가
    const maxExecutionTime = 20 * 60 * 1000; // 20분을 밀리초로 변환
    const startTime = Date.now();

    do {
        //console.log("url : " + url);

        // 무한 루프 방지용 조건 추가
        if (Date.now() - startTime > maxExecutionTime) {
            console.log("최대 실행 시간(20분)을 초과하여 루프를 종료합니다.");
            break;
        }

        let data: string;
        try {
            const resp = await request(url, options.requestOptions);
            assertUndiciOkResponse(resp);
            data = await resp.body.text();
            cookieJar.utilizeResponseHeaders(resp.headers);
        } catch (err) {
            throw new Error(`Failed to fetch url "${url}". (${err})`);
        }

        let contents: any;
        try {
            const raw = data.substring(
                data.lastIndexOf(
                    '"sectionListRenderer":{"contents":[{"itemSectionRenderer":'
                ) + 58,
                data.lastIndexOf('},{"continuationItemRenderer"')
            );
            contents = JSON.parse(raw)?.contents;
        } catch (err) {
            throw new Error(`Failed to parse contents from data. (${err})`);
        }

        for (const {
            videoRenderer,
            channelRenderer,
            playlistRenderer,
        } of contents) {
            if (videoRenderer) {
                const x = videoRenderer;
                const video: SearchVideo = {
                    title: x?.title?.runs[0]?.text,
                    id: x?.videoId,
                    url:
                        constants.urls.base +
                        x?.navigationEndpoint?.commandMetadata
                            ?.webCommandMetadata?.url,
                    channel: {
                        name: x?.ownerText?.runs[0]?.text,
                        id: x?.ownerText?.runs[0]?.navigationEndpoint
                            ?.browseEndpoint?.browseId,
                        url:
                            constants.urls.base +
                            x?.ownerText?.runs[0]?.navigationEndpoint
                                ?.commandMetadata?.webCommandMetadata?.url,
                    },
                    duration: {
                        text: x?.lengthText?.simpleText,
                        pretty: x?.lengthText?.accessibility?.accessibilityData
                            ?.label,
                    },
                    published: {
                        pretty: x?.publishedTimeText?.simpleText,
                    },
                    views: {
                        text: x?.viewCountText?.simpleText,
                        pretty: x?.shortViewCountText?.simpleText,
                        prettyLong:
                            x?.shortViewCountText?.accessibility
                                ?.accessibilityData?.label,
                    },
                    thumbnails: x?.thumbnail?.thumbnails,
                };
                result.videos.push(video);
            }

            if (channelRenderer) {
                const x = channelRenderer;
                const channel: SearchChannel = {
                    name: x?.title?.simpleText,
                    id: x?.channelId,
                    url:
                        constants.urls.base +
                        x?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl,
                    subscribers: {
                        text: x?.subscriberCountText?.simpleText,
                        pretty: x?.subscriberCountText?.accessibility
                            ?.accessibilityData?.label,
                    },
                    icons: x?.thumbnail?.thumbnails,
                    badges: ((x?.ownerBadges ?? []) as any[])?.reduce(
                        (pv, cv) => {
                            const name = cv?.metadataBadgeRenderer?.tooltip;
                            if (name) pv.push(name);
                            return pv;
                        },
                        [] as string[]
                    ),
                };
                result.channels.push(channel);
            }

            if (playlistRenderer) {
                const x = playlistRenderer;
                const playlist: SearchPlaylist = {
                    name: x?.title?.simpleText,
                    id: x?.playlistId,
                    url:
                        constants.urls.base +
                        x?.navigationEndpoint?.commandMetadata
                            ?.webCommandMetadata?.url,
                    thumbnails:
                        x?.thumbnailRenderer?.playlistVideoThumbnailRenderer
                            ?.thumbnail?.thumbnails,
                    videoCount: x?.videoCount,
                    published: {
                        pretty: x?.publishedTimeText?.simpleText,
                    },
                };
                result.playlists.push(playlist);
            }
        }

        // Check for continuation token
        const continuationData = data.match(
            /"continuationCommand":{"token":"(.*?)"/
        );
        if (
            continuationData &&
            continuationData.length > 1 &&
            continuationData[1]
        ) {
            continuationToken = continuationData[1];
        }
        if (continuationToken) {
            url =
                constants.urls.search.base(terms) +
                "&continuation=" +
                continuationToken;
        }

        for (const channel of result.channels) {
            result.uniqueChannelIds.add(channel.id);
        }

        for (const video of result.videos) {
            result.uniqueChannelIds.add(video.channel.id);
        }

        /*
        for (const play of result.playlists) {
            uniqueChannelIds.add(play.id);
        }
        */

        // 중복되지 않는 채널 ID의 개수를 가져옴
        const uniqueChannelCount = result.uniqueChannelIds.size;

        console.log("중복되지 않는 채널 찾는중.. : " + uniqueChannelCount);

        if (limit && uniqueChannelCount >= limit) {
            break;
        }
        // sleep (1초)
        await new Promise((resolve) => setTimeout(resolve, 1000));
    } while (
        continuationToken &&
        (!limit || result.uniqueChannelIds.size < limit)
    );

    return result;
};

export default search;
