import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import BackButton from './Backbutton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Shape returned directly by the API
interface ApiArticle {
  id: string
  title: string
  category: string
  date: string // e.g. "15 Jan 2026"
  lang: string
  text: string // HTML content
  image: string
  publish: string
  front: string
  permalink: string
  created: string
}

interface ApiArticleResponse {
  content: ApiArticle
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

const API_BASE_URL = 'https://mbapi.dswip.com'

async function getArticle(permalink: string): Promise<ApiArticle | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/article/get_by_permalink/${permalink}`, {
      // Revalidate periodically instead of refetching on every request.
      next: { revalidate: 3600 },
    })

    if (!res.ok) return null

    const data: ApiArticleResponse = await res.json()
    if (!data?.content) return null

    return data.content
  } catch {
    return null
  }
}

// The API's `image` field currently comes back without a filename in some
// cases (e.g. just the folder path). Guard against rendering a broken <Image>.
function hasValidImage(image: string | undefined | null): image is string {
  if (!image) return false
  const lastSegment = image.split('/').pop() ?? ''
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(lastSegment)
}

// Strip HTML tags to build a short plain-text excerpt for <meta description>.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Works whether your Next.js version passes `params` as a plain object
// (Next.js <= 14) or as a Promise (Next.js 15+).
type ParamsInput = { slug: string } | Promise<{ slug: string }>

async function resolveParams(params: ParamsInput): Promise<{ slug: string }> {
  return await params
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: ParamsInput
}): Promise<Metadata> {
  const { slug } = await resolveParams(params)
  const article = await getArticle(slug)

  if (!article) {
    return { title: 'Artikel Tidak Ditemukan | Mercedes Benz W202 Club Indonesia' }
  }

  const excerpt = stripHtml(article.text).slice(0, 160)

  return {
    title: `${article.title} | Mercedes Benz W202 Club Indonesia`,
    description: excerpt,
    openGraph: {
      title: article.title,
      description: excerpt,
      url: `https://mbw202clubindonesia.vercel.app/article/${article.permalink}`,
      siteName: 'Mercedes Benz W202 Club Indonesia',
      images: hasValidImage(article.image) ? [{ url: article.image }] : undefined,
      locale: 'id_ID',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: excerpt,
      images: hasValidImage(article.image) ? [article.image] : undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ArticleDetailPage({
  params,
}: {
  params: ParamsInput
}) {
  const { slug } = await resolveParams(params)
  const article = await getArticle(slug)

  if (!article) {
    notFound()
  }

  const showImage = hasValidImage(article.image)

  return (
    <div className="page-wrapper">
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          {/* Category + title (full width, above the two columns) */}
          <div className="mb-10">
            {article.category && (
              <span className="inline-block text-xs font-medium uppercase tracking-wide bg-brand-accent text-white px-3 py-1 rounded-full mb-4">
                {article.category}
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-sans font-bold text-brand-primary max-w-3xl leading-tight">
              {article.title}
            </h1>
          </div>

          {/* Two-column layout: image left, content right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left column - cover image */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              {showImage ? (
                <div className="relative w-full h-72 sm:h-96 lg:h-[480px] rounded-lg overflow-hidden">
                  <Image
                    src={article.image}
                    alt={article.title}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              ) : (
                <div className="w-full h-72 sm:h-96 lg:h-[480px] rounded-lg bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">Tidak ada gambar</span>
                </div>
              )}
            </div>

            {/* Right column - content */}
            <div>
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 border-b border-gray-200 pb-6 mb-8">
                <time>{article.date}</time>
              </div>

              {/* Article body (HTML from CMS) */}
              <div
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: article.text }}
              />

              {/* Back navigation */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <BackButton />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}