// Minimal markdown renderer for Gemini chat responses.
// Handles the subset the model actually produces: headings (#, ##, ###),
// bullet lists (- or *), numbered lists (1.), inline **bold**, *italic*,
// and `code`. No links, no images, no nested lists, no tables — we don't
// need them and keeping the parser tiny keeps the bundle tiny.

import React from "react"

type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string }

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const hMatch = /^(#{1,3})\s+(.*)$/.exec(line)
    if (hMatch) {
      blocks.push({
        type: "h",
        level: hMatch[1].length as 1 | 2 | 3,
        text: hMatch[2].trim(),
      })
      i++
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""))
        i++
      }
      blocks.push({ type: "ul", items })
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i++
      }
      blocks.push({ type: "ol", items })
      continue
    }

    // Paragraph — collect consecutive non-blank, non-special lines.
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: "p", text: para.join(" ") })
  }
  return blocks
}

// Inline pass — tokenises **bold**, *italic*, `code`. Order matters: bold
// before italic so the **…** match wins.
function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = []
  const re = /(\*\*[^*\n]+?\*\*|`[^`\n]+?`|\*[^*\n]+?\*)/g
  let lastIndex = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) tokens.push(text.slice(lastIndex, m.index))
    const match = m[0]
    if (match.startsWith("**")) {
      tokens.push(<strong key={key++} className="font-semibold text-foreground">{match.slice(2, -2)}</strong>)
    } else if (match.startsWith("`")) {
      tokens.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-muted/70 text-[0.92em] font-mono"
        >
          {match.slice(1, -1)}
        </code>
      )
    } else {
      tokens.push(<em key={key++}>{match.slice(1, -1)}</em>)
    }
    lastIndex = m.index + match.length
  }
  if (lastIndex < text.length) tokens.push(text.slice(lastIndex))
  return tokens
}

export function MarkdownText({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  return (
    <div className="space-y-2 text-foreground">
      {blocks.map((block, idx) => {
        if (block.type === "h") {
          const sizes = {
            1: "text-[13px] font-semibold mt-1",
            2: "text-[12.5px] font-semibold mt-1",
            3: "text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mt-1",
          } as const
          return (
            <p key={idx} className={sizes[block.level]}>
              {renderInline(block.text)}
            </p>
          )
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="space-y-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-primary mt-[5px] shrink-0 h-1 w-1 rounded-full bg-primary" />
                  <span className="min-w-0">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="space-y-1 list-decimal pl-5 marker:text-muted-foreground/70">
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed pl-1">{renderInline(item)}</li>
              ))}
            </ol>
          )
        }
        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}
