'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center text-brand-primary font-medium hover:text-brand-accent transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mr-2"
      >
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </svg>
      Kembali
    </button>
  )
}