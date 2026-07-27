import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const revalidate = 3600;

const CHANNEL_ID = "UCuCjhL4QLCVxOXDbuo6JuUA";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export interface YoutubeFeedItem {
  videoId: string;
  title: string;
  link: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  channelId: string;
  channelUrl: string;
  channelTitle: string;
}

interface YoutubeFeedResponse {
  items: YoutubeFeedItem[];
  error: string | null;
}

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function extractText(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "#text" in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

function getNested(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function extractViewsFromEntry(entry: unknown): number {
  const candidates: string[][] = [
    ["media:group", "media:community", "media:statistics", "@_views"],
    ["group", "community", "statistics", "@_views"],
    ["media:group", "media:community", "media:statistics", "views"],
    ["group", "community", "statistics", "views"],
    ["yt:statistics", "@_views"],
    ["statistics", "@_views"],
    ["yt:statistics", "views"],
    ["statistics", "views"],
  ];

  for (const path of candidates) {
    const val = getNested(entry, path);
    if (val !== undefined && val !== null) {
      const s = String(val).replace(/[ ,\s]/g, "");
      const n = Number(s);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }

  return 0;
}

function normalizePublishedAt(raw: unknown): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function extractTextFromRegex(input: string, pattern: RegExp): string {
  const match = input.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function parseFeed(xml: string) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      isArray: (name) => name === "entry",
    });

    const parsed = parser.parse(xml) as Record<string, unknown>;
    const feed = parsed?.feed as Record<string, unknown> | undefined;

    if (!feed) {
      return { feed: undefined, entries: [] as Record<string, unknown>[] };
    }

    return { feed, entries: toArray(feed.entry as unknown) };
  } catch {
    const channelId = extractTextFromRegex(xml, /<yt:channelId>(.*?)<\/yt:channelId>/i) || CHANNEL_ID;
    const title = extractTextFromRegex(xml, /<title>([\s\S]*?)<\/title>/i);
    const authorName = extractTextFromRegex(xml, /<author>[\s\S]*?<name>(.*?)<\/name>/i);
    const authorUri = extractTextFromRegex(xml, /<author>[\s\S]*?<uri>(.*?)<\/uri>/i);

    const entryBodies = Array.from(xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)).map((m) => m[1]);
    const entries = entryBodies.map((body) => ({
      title: extractTextFromRegex(body, /<title>([\s\S]*?)<\/title>/i),
      published: extractTextFromRegex(body, /<published>(.*?)<\/published>/i) || extractTextFromRegex(body, /<updated>(.*?)<\/updated>/i),
      "yt:videoId": extractTextFromRegex(body, /<yt:videoId>(.*?)<\/yt:videoId>/i) || extractTextFromRegex(body, /<videoId>(.*?)<\/videoId>/i),
      link: {
        "@_href": extractTextFromRegex(body, /<link\b[^>]*href=["']([^"']+)["'][^>]*>/i),
      },
      "media:group": {
        "media:thumbnail": {
          "@_url": extractTextFromRegex(body, /<media:thumbnail\b[^>]*url=["']([^"']+)["'][^>]*>/i),
        },
        "media:community": {
          "media:statistics": {
            "@_views": extractTextFromRegex(body, /<media:statistics\b[^>]*views=["']?([0-9,]+)["']?/i),
          },
        },
      },
    }));

    return {
      feed: {
        "yt:channelId": channelId,
        title,
        author: { name: authorName, uri: authorUri },
        entry: entries,
      },
      entries,
    };
  }
}

async function fetchFeedText(): Promise<string | null> {
  const urls = [FEED_URL, `https://youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`];

  for (const url of urls) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; MBW202CI-Bot/1.0; +https://mbadministrator.dswip.com)",
            Accept: "application/atom+xml, text/xml, */*",
            Referer: "https://www.youtube.com/",
          },
        });

        if (res.ok) {
          const text = await res.text();
          if (text.includes("<feed") || text.includes("<entry")) {
            return text;
          }
        }
      } catch {
        // continue to next retry / URL
      }

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  return null;
}

export async function GET() {
  try {
    const xml = await fetchFeedText();

    if (!xml) {
      const body: YoutubeFeedResponse = {
        items: [],
        error: "Feed YouTube sedang tidak tersedia. Silakan coba lagi nanti.",
      };
      return NextResponse.json(body, { status: 200 });
    }

    const { feed, entries } = parseFeed(xml);

    if (!feed) {
      const body: YoutubeFeedResponse = {
        items: [],
        error: "Format feed tidak dikenali",
      };
      return NextResponse.json(body, { status: 200 });
    }

    const channelId: string = (feed["yt:channelId"] as string) || CHANNEL_ID;
    const author = feed.author as Record<string, unknown> | undefined;
    const channelTitle: string =
      extractText(author?.name) || extractText(feed.title) || "";
    const channelUrl: string =
      (author?.uri as string) || `https://www.youtube.com/channel/${channelId}`;

    const items: YoutubeFeedItem[] = entries
      .map((entry: unknown) => {
        const e = entry as Record<string, unknown>;
        const mediaGroup =
          (e["media:group"] as Record<string, unknown>) ||
          (e["group"] as Record<string, unknown>) ||
          {};

        const mediaThumbnail =
          (mediaGroup["media:thumbnail"] as Record<string, unknown>) ||
          (mediaGroup["thumbnail"] as Record<string, unknown>) ||
          {};

        const thumbnail: string =
          (mediaThumbnail["@_url"] as string) ||
          (mediaThumbnail["url"] as string) ||
          "";

        const videoId: string =
          (e["yt:videoId"] as string) || (e["videoId"] as string) || "";

        const linkObj = e.link as Record<string, unknown> | undefined;
        const link: string =
          (linkObj?.["@_href"] as string) ||
          (linkObj?.["href"] as string) ||
          (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");

        const publishedAt = normalizePublishedAt(e.published ?? e.updated);

        return {
          videoId,
          title: extractText(e.title),
          link,
          thumbnail,
          publishedAt,
          viewCount: extractViewsFromEntry(entry),
          channelId,
          channelUrl,
          channelTitle,
        } satisfies YoutubeFeedItem;
      })
      .filter((item) => Boolean(item.videoId))
      .slice(0, 8);

    const body: YoutubeFeedResponse = { items, error: null };
    return NextResponse.json(body, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const body: YoutubeFeedResponse = {
      items: [],
      error: message,
    };
    return NextResponse.json(body, { status: 200 });
  }
}


