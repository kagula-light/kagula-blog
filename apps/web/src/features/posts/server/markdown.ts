import { marked } from "marked";
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
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: false,
    gfm: true,
  });

  return sanitizeHtml(rendered, {
    allowedTags: [...allowedTags],
    allowedAttributes: {
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
