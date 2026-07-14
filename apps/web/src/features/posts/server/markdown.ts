import { marked, Renderer } from "marked";
import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "blockquote",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "del",
  "a",
  "img",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
] as const;

export function renderMarkdown(markdown: string): string {
  const headingCounts = new Map<string, number>();
  const renderer = new Renderer();
  renderer.heading = function renderHeading({ tokens, depth }) {
    const content = this.parser.parseInline(tokens);
    const plainText = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
    const baseId =
      plainText
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "") || "section";
    const count = (headingCounts.get(baseId) ?? 0) + 1;
    headingCounts.set(baseId, count);
    const id = count === 1 ? baseId : `${baseId}-${count}`;
    return `<h${depth} id="${id}">${content}</h${depth}>`;
  };

  const rendered = marked.parse(markdown, {
    async: false,
    breaks: false,
    gfm: true,
    renderer,
  });

  return sanitizeHtml(rendered, {
    allowedTags: [...allowedTags],
    allowedAttributes: {
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      th: ["align"],
      td: ["align"],
    },
    allowedClasses: {
      code: ["language-*"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attributes) => {
        const href = attributes.href ?? "";
        if (/^https?:\/\//i.test(href)) {
          return {
            tagName,
            attribs: {
              ...attributes,
              target: "_blank",
              rel: "noopener noreferrer",
            },
          };
        }
        return { tagName, attribs: attributes };
      },
    },
  });
}

export interface HeadingOutlineItem {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

export function extractHeadingOutline(html: string): readonly HeadingOutlineItem[] {
  const outline: HeadingOutlineItem[] = [];
  const headingPattern = /<h([23]) id="([\p{L}\p{N}-]+)">([\s\S]*?)<\/h\1>/gu;
  for (const match of html.matchAll(headingPattern)) {
    const [, rawLevel, id, content] = match;
    if (!id || !content || (rawLevel !== "2" && rawLevel !== "3")) continue;
    outline.push({
      id,
      text: sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim(),
      level: Number(rawLevel) as 2 | 3,
    });
  }
  return outline;
}
