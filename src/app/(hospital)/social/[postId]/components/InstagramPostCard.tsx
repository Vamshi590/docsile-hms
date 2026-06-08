"use client"

import { useState } from "react"
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"

type Props = {
  hospitalName: string
  hospitalLogoUrl: string | null
  caption: string
  hashtags: string[]
  slideUrls: string[]
}

export function InstagramPostCard(props: Props) {
  const { hospitalName, hospitalLogoUrl, caption, hashtags, slideUrls } = props
  const isCarousel = slideUrls.length > 1
  const [index, setIndex] = useState(0)
  const [captionExpanded, setCaptionExpanded] = useState(false)

  const handle = hospitalName.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const captionFull = hashtags.length
    ? `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
    : caption
  const captionShort = captionFull.length > 120 ? captionFull.slice(0, 120).trimEnd() : captionFull
  const captionTruncated = captionFull.length > captionShort.length

  return (
    <div className="mx-auto w-full max-w-[470px] rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {hospitalLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hospitalLogoUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-200" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 p-[2px]">
              <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-sm font-bold text-zinc-700">
                {hospitalName[0]?.toUpperCase() ?? "?"}
              </div>
            </div>
          )}
          <div className="text-sm font-semibold text-zinc-900">{handle}</div>
        </div>
        <MoreHorizontal className="h-5 w-5 text-zinc-700" />
      </div>

      {/* Image / carousel */}
      <div className="relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slideUrls[index]}
          alt={`slide ${index + 1}`}
          className="w-full aspect-square object-cover select-none"
          draggable={false}
        />

        {isCarousel && (
          <>
            {/* prev */}
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/80 hover:bg-white text-zinc-800 flex items-center justify-center shadow"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {/* next */}
            {index < slideUrls.length - 1 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/80 hover:bg-white text-zinc-800 flex items-center justify-center shadow"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {/* counter pill */}
            <div className="absolute top-2 right-2 rounded-full bg-black/65 text-white text-xs font-medium px-2 py-0.5">
              {index + 1}/{slideUrls.length}
            </div>
          </>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-zinc-800" strokeWidth={1.75} />
          <MessageCircle className="h-6 w-6 text-zinc-800" strokeWidth={1.75} />
          <Send className="h-6 w-6 text-zinc-800" strokeWidth={1.75} />
        </div>
        {isCarousel && (
          <div className="flex items-center gap-1">
            {slideUrls.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-sky-500" : "bg-zinc-300"}`}
              />
            ))}
          </div>
        )}
        <Bookmark className="h-6 w-6 text-zinc-800" strokeWidth={1.75} />
      </div>

      {/* Caption */}
      <div className="px-3 pt-2 pb-3 text-sm text-zinc-900">
        <span className="font-semibold mr-1.5">{handle}</span>
        <span className="whitespace-pre-wrap">
          {captionExpanded || !captionTruncated ? captionFull : `${captionShort}… `}
        </span>
        {captionTruncated && !captionExpanded && (
          <button
            type="button"
            onClick={() => setCaptionExpanded(true)}
            className="text-zinc-500 hover:text-zinc-700"
          >
            more
          </button>
        )}
      </div>
    </div>
  )
}
