import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

// Revalidate cache setiap 1 jam (ISR-style caching untuk Route Handler)
export const revalidate = 3600;

const CHANNEL_ID = "UCuCjhL4QLCVxOXDbuo6JuUA";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export interface YoutubeFeedItem {
  videoId: string;
  title: string;
  /** Direct link ke video YouTube */
  link: string;
  thumbnail: string;
  /** ISO 8601 string, e.g. "2026-06-07T12:00:06+00:00" */
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

// Helper: field XML bisa berupa object tunggal atau array tergantung jumlah item.
// Fungsi ini menormalkan supaya selalu berbentuk array.
function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// Helper: title/text node kadang berupa string langsung, kadang object { "#text": "..." }
// tergantung ada/tidaknya atribut pada tag tsb.
function extractText(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "#text" in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

// Robust nested getter that accepts multiple possible key names (with/without namespace)
function getNested(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * Ekstrak jumlah views dari entry Atom feed YouTube.
 *
 * Struktur XML yang dihasilkan YouTube (dengan ignoreAttributes: false):
 *   <media:group>
 *     <media:community>
 *       <media:statistics views="12345"/>   ← views adalah ATRIBUT, bukan text node
 *     </media:community>
 *   </media:group>
 *
 * fast-xml-parser memetakan atribut ke "@_views" (dengan attributeNamePrefix "@_").
 * Kandidat path disusun dari yang paling spesifik/umum ke yang paling fallback.
 */
function extractViewsFromEntry(entry: unknown): number {
  const candidates: string[][] = [
    // Dengan namespace prefix (output paling umum dari fast-xml-parser)
    ["media:group", "media:community", "media:statistics", "@_views"],
    // Tanpa namespace (beberapa build parser strip namespace)
    ["group", "community", "statistics", "@_views"],
    // Jika attributeNamePrefix tidak dipakai / versi lama parser
    ["media:group", "media:community", "media:statistics", "views"],
    ["group", "community", "statistics", "views"],
    // Fallback: yt:statistics langsung di root entry
    ["yt:statistics", "@_views"],
    ["statistics", "@_views"],
    ["yt:statistics", "views"],
    ["statistics", "views"],
  ];

  for (const path of candidates) {
    const val = getNested(entry, path);
    if (val !== undefined && val !== null) {
      const s = String(val).replace(/[,\s]/g, "");
      const n = Number(s);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }

  return 0;
}

/**
 * Validasi dan normalisasi ISO 8601 date string dari feed.
 * YouTube feed mengirimkan format: "2026-06-07T12:00:06+00:00"
 * Pastikan string valid sebelum dikirim ke client.
 */
function normalizePublishedAt(raw: unknown): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  // Cek apakah bisa diparsing menjadi Date yang valid
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return "";
  // Kembalikan sebagai ISO string standar (UTC)
  return d.toISOString();
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      next: { revalidate },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MBW202CI-Bot/1.0; +https://mbadministrator.dswip.com)",
        Accept: "application/atom+xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      const body: YoutubeFeedResponse = {
        items: [],
        error: `Gagal mengambil feed YouTube (status ${res.status})`,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const xml = await res.text();

    // PENTING: ignoreAttributes HARUS false supaya atribut seperti
    // <media:statistics views="12345"/> bisa dibaca sebagai "@_views".
    // isArray callback memastikan <entry> selalu jadi array meski hanya 1 item.
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      isArray: (name) => name === "entry",
    });

    const parsed = parser.parse(xml) as Record<string, unknown>;
    const feed = parsed?.feed as Record<string, unknown> | undefined;

    if (!feed) {
      const body: YoutubeFeedResponse = {
        items: [],
        error: "Format feed tidak dikenali (tag <feed> tidak ditemukan)",
      };
      return NextResponse.json(body, { status: 200 });
    }

    const channelId: string =
      (feed["yt:channelId"] as string) || CHANNEL_ID;

    const author = feed.author as Record<string, unknown> | undefined;
    const channelTitle: string =
      extractText(author?.name) || extractText(feed.title) || "";
    const channelUrl: string =
      (author?.uri as string) ||
      `https://www.youtube.com/channel/${channelId}`;

    // Dengan isArray callback di atas, entries selalu array — tidak perlu toArray lagi,
    // tapi tetap kita wrap untuk safety jika parser versi lain tidak menerapkannya.
    const entries = toArray(feed.entry as unknown);

    const items: YoutubeFeedItem[] = entries
      .map((entry: unknown) => {
        const e = entry as Record<string, unknown>;

        const mediaGroup =
          (e["media:group"] as Record<string, unknown>) ||
          (e["group"] as Record<string, unknown>) ||
          {};

        const viewCount = extractViewsFromEntry(entry);

        // Thumbnail URL disimpan sebagai atribut @_url pada <media:thumbnail>
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

        // Link video (bukan channel) — link adalah object dengan atribut @_href
        const linkObj = e.link as Record<string, unknown> | undefined;
        const videoLink: string =
          (linkObj?.["@_href"] as string) ||
          (linkObj?.["href"] as string) ||
          (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");

        // published lebih akurat dari updated (updated bisa berubah karena edit metadata)
        const publishedAt = normalizePublishedAt(e.published ?? e.updated);

        return {
          videoId,
          title: extractText(e.title),
          link: videoLink,
          thumbnail,
          publishedAt,
          viewCount,
          channelId,
          channelUrl,
          channelTitle,
        } satisfies YoutubeFeedItem;
      })
      // Buang entry tanpa videoId (malformed) dan batasi 8 video terbaru
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