"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useChapterById } from "@/lib/hooks/useChapterById";
import { useArticleIndexWebsite } from "@/lib/hooks/useArticleIndexWebsite";
import { CHAPTER_ID, CATEGORIES } from "@/lib/constants/api";
import type { YoutubeFeedItem } from "@/app/api/youtube/route";

// ---------------------------------------------------------------------------
// Instagram helpers
// ---------------------------------------------------------------------------

const extractInstagramPostId = (text: string): string | null => {
  if (!text) return null;
  const cleanText = text.replace(/<[^>]*>/g, "").replace(/[\n\t\r]/g, "").trim();
  const match = cleanText.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
};

// ---------------------------------------------------------------------------
// YouTube display helpers
// ---------------------------------------------------------------------------

/**
 * Format angka views ke format ringkas: 1234 → "1.2K", 1500000 → "1.5M"
 * Sengaja pakai satu desimal supaya lebih informatif (misal "2.2K" bukan "2K").
 */
const formatViews = (n: number): string => {
  const num = Number(n) || 0;
  if (num < 1000) return `${num}`;
  if (num < 1_000_000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
};

/**
 * Konversi ISO 8601 date string ke format relatif "X time ago".
 *
 * Contoh input : "2026-06-07T12:00:06+00:00"
 * Contoh output: "5 weeks ago", "3 days ago", "20 hours ago", "just now"
 *
 * PENTING: fungsi ini menerima `now` sebagai parameter agar bisa dipanggil
 * dari dalam useEffect (nilai Date.now() client-side), sehingga tidak terjadi
 * hydration mismatch antara server render dan client render.
 */
const timeAgo = (iso: string, now: number): string => {
  if (!iso) return "";
  const past = new Date(iso).getTime();
  if (isNaN(past)) return "";

  const diffMs = now - past;

  // Tangani kasus waktu di masa depan (timezone offset tidak tepat, dll.)
  if (diffMs < 0) return "just now";

  const sec = Math.floor(diffMs / 1000);

  const units: [number, string][] = [
    [365 * 24 * 3600, "year"],
    [30 * 24 * 3600, "month"],
    [7 * 24 * 3600, "week"],
    [24 * 3600, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];

  for (const [threshold, label] of units) {
    const v = Math.floor(sec / threshold);
    if (v >= 1) return `${v} ${label}${v > 1 ? "s" : ""} ago`;
  }

  // Kurang dari 1 menit
  return sec < 10 ? "just now" : `${sec} seconds ago`;
};

// ---------------------------------------------------------------------------
// Thumbnail component
// ---------------------------------------------------------------------------

const isNextImageDomainAllowed = (url?: string): boolean => {
  if (!url) return false;
  try {
    const h = new URL(url).hostname;
    return h === "img.youtube.com" || h === "mbadministrator.dswip.com";
  } catch {
    return false;
  }
};

function Thumbnail({ src, alt }: { src?: string; alt?: string }) {
  if (!src) return null;

  if (isNextImageDomainAllowed(src)) {
    return (
      <div className="relative w-full h-28 rounded overflow-hidden">
        <Image
          src={src}
          alt={alt || "thumbnail"}
          fill
          sizes="(min-width: 640px) 200px, 100px"
          className="object-cover rounded"
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || "thumbnail"}
      loading="lazy"
      className="w-full h-28 object-cover rounded"
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton untuk YouTube cards
// ---------------------------------------------------------------------------

function YoutubeCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col gap-2 animate-pulse">
      <div className="w-full h-28 bg-gray-200 rounded" />
      <div className="h-3 bg-gray-200 rounded w-full" />
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-2 bg-gray-100 rounded w-1/2 mt-1" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YoutubeApiResponse {
  items: YoutubeFeedItem[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HomeOrganization() {
  const { data: chapterData } = useChapterById(CHAPTER_ID);

  const { data: activitiesData } = useArticleIndexWebsite({
    chapter: CHAPTER_ID,
    category: CATEGORIES.REGIONAL_ACTIVITY,
    limit: 6,
    offset: 0,
    orderby: "",
    order: "asc",
  });

  const presidentMessage =
    chapterData?.content?.result?.desc ||
    `Mercedes-Benz W202 Club Indonesia adalah Club Otomotif yang mempunyai historia yang panjang. Kami berkomitmen untuk membawa Mercedes-Benz W202 Club Indonesia Bersama Melaju Lebih Jauh dan mempersatukan seluruh Member dari Region dan District untuk memperkuat solidaritas antar anggota, dan membawa komunitas menuju era yang lebih modern, dinamis, berdaya guna, dan dikenal secara Nasional maupun Internasional.`;
  const presidentName =
    chapterData?.content?.result?.chief || "Hamzah Lutfi Abdat";

  const activities = activitiesData?.content?.result || [];

  // YouTube state
  const [youtubeItems, setYoutubeItems] = useState<YoutubeFeedItem[]>([]);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(true);

  /**
   * `clientNow` disimpan di state dan hanya di-set setelah mount (client-side).
   * Ini mencegah hydration mismatch karena timeAgo() bergantung pada Date.now()
   * yang berbeda di server vs client.
   */
  const [clientNow, setClientNow] = useState<number>(0);

  useEffect(() => {
    // Set waktu client setelah hydration selesai
    setClientNow(Date.now());
  }, []);

  useEffect(() => {
    let mounted = true;

    setYoutubeLoading(true);

    fetch("/api/youtube")
      .then((r) => r.json() as Promise<YoutubeApiResponse>)
      .then((d) => {
        if (!mounted) return;
        setYoutubeLoading(false);

        if (d?.items && Array.isArray(d.items) && d.items.length > 0) {
          setYoutubeItems(d.items);
          setYoutubeError(null);
        } else {
          setYoutubeItems([]);
          setYoutubeError(d?.error ?? "Feed kosong atau gagal diparse");
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setYoutubeLoading(false);
        setYoutubeItems([]);
        const msg = err instanceof Error ? err.message : String(err);
        setYoutubeError(msg);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="py-4 md:py-16 lg:py-24 mt-2">
      <div className="container mx-auto px-4">
        {/* Section Title */}
        <div className="mb-8 md:mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-heading text-brand-primary inline-block">
            Organization
            <div className="h-1 w-20 bg-brand-accent mt-2 mx-auto" />
          </h2>
        </div>

        <div className="bg-gray-100 rounded-lg shadow-md p-6 md:p-8">
          {/* ------------------------------------------------------------------ */}
          {/* President's Message Card                                            */}
          {/* ------------------------------------------------------------------ */}
          <div className="flex flex-col md:flex-row items-center mb-10 p-6 bg-white rounded-lg shadow-sm">
            <div className="md:w-1/3 flex justify-center">
              <Image
                src="/logo-pengurus.png"
                alt="MBW202CI Logo"
                width={150}
                height={150}
                className="w-32 h-32 md:w-40 md:h-40"
              />
            </div>
            <div className="md:w-2/3 mt-6 md:mt-0 md:ml-6">
              <blockquote className="text-gray-700 italic relative pl-4 border-l-4 border-brand-accent">
                <p className="text-lg mb-4">{presidentMessage}</p>
                <footer className="text-right">
                  <cite className="font-medium text-mercedes-blue">
                    - {presidentName}, Presiden MBW202CI
                  </cite>
                </footer>
              </blockquote>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* YouTube Channel                                                     */}
          {/* ------------------------------------------------------------------ */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-brand-primary text-left mb-6">
              Channel YouTube
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Loading skeletons */}
              {youtubeLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <YoutubeCardSkeleton key={i} />
                ))}

              {/* Error state */}
              {!youtubeLoading && youtubeError && (
                <p className="col-span-full text-center text-sm text-muted">
                  {youtubeError}
                </p>
              )}

              {/* Empty state */}
              {!youtubeLoading &&
                !youtubeError &&
                youtubeItems.length === 0 && (
                  <p className="col-span-full text-center text-sm text-muted">
                    Belum ada video.
                  </p>
                )}

              {/* Video cards */}
              {!youtubeLoading &&
                youtubeItems.map((item) => (
                  <a
                    key={item.videoId}
                    // FIX: link mengarah ke video (item.link), BUKAN channel URL.
                    // channelUrl tersedia sebagai fallback jika link video kosong.
                    href={
                      item.link ||
                      (item.videoId
                        ? `https://www.youtube.com/watch?v=${item.videoId}`
                        : item.channelUrl || "#")
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="bg-white rounded-lg shadow-sm p-3 flex flex-col items-start text-left overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <Thumbnail src={item.thumbnail} alt={item.title} />

                    {/* Judul video */}
                    <div className="mt-2 text-sm text-brand-gray line-clamp-2 font-bold leading-snug">
                      {item.title}
                    </div>

                    {/* Views & waktu upload — hanya render setelah client mount */}
                    <div className="mt-1 text-xs text-brand-gray flex items-center gap-1 font-medium">
                        <>
                          <span>{formatViews(item.viewCount)} views</span>
                          {item.publishedAt && (
                            <>
                              <span className="opacity-40">·</span>
                              <span>{timeAgo(item.publishedAt, clientNow)}</span>
                            </>
                          )}
                        </>
                    </div>
                  </a>
                ))}
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Regional Activities                                                  */}
          {/* ------------------------------------------------------------------ */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-brandPrimary text-left mb-6">
              Aktivitas Regional
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {activities.map((activity, index) => {
                const postId = extractInstagramPostId(activity.text);
                if (!postId) return null;

                return (
                  <div key={activity.id} className="relative">
                    <div className="instagram-embed-container">
                      <iframe
                        className="instagram-media instagram-media-rendered"
                        id={`instagram-embed-${index}`}
                        loading="lazy"
                        src={`https://www.instagram.com/p/${postId}/embed/captioned/?cr=1&v=14&wp=382`}
                        allowFullScreen
                        frameBorder="0"
                        data-instgrm-payload-id={`instagram-media-payload-${index}`}
                        scrolling="no"
                        height={963}
                        style={{
                          background: "white",
                          maxWidth: "540px",
                          width: "calc(100% - 2px)",
                          borderRadius: "3px",
                          border: "1px solid rgb(219, 219, 219)",
                          boxShadow: "none",
                          display: "block",
                          margin: "0px 0px 12px",
                          minWidth: "326px",
                          padding: "0px",
                        }}
                        title={activity.title}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-8">
            <a href="/organization">
              <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-white h-10 px-6 py-2 border border-brand-primary text-brand-primary rounded font-medium hover:bg-brand-primary hover:text-white">
                Selengkapnya
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}