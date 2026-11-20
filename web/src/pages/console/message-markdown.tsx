import { memo } from "react";
import DOMPurify from "dompurify";
import { Marked, type Token, type Tokens } from "marked";

const markdown = new Marked({
  breaks: true,
  renderer: {
    html({ text }) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
  },
});

// Prefer the literal message for ambiguous constructs such as a bare URL or indented line.
function hasExplicitFormatting(token: Token): boolean {
  switch (token.type) {
    case "heading":
    case "blockquote":
    case "table":
    case "strong":
    case "em":
    case "codespan":
    case "image":
      return true;
    case "del":
      return token.raw.startsWith("~~");
    case "link":
      return token.raw.startsWith("[") || token.raw.startsWith("<");
    case "list":
      return token.items.length > 1 || token.items.some((item: Tokens.ListItem) => item.task);
    case "code": {
      const fence = /^ {0,3}(`{3,}|~{3,})/.exec(token.raw)?.[1];
      if (!fence) return false;
      const closingFence = new RegExp("\\n {0,3}" + fence[0] + "{" + fence.length + ",}[ \\t]*$");
      return closingFence.test(token.raw.trimEnd());
    }
    default:
      return false;
  }
}

export const MessageMarkdown = memo(function MessageMarkdown({ text }: { text: string }) {
  const tokens = markdown.lexer(text);
  let formatted = false;
  markdown.walkTokens(tokens, (token) => {
    if (hasExplicitFormatting(token)) formatted = true;
  });
  if (!formatted) {
    return <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>;
  }

  const html = DOMPurify.sanitize(markdown.parser(tokens), {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "del",
      "a",
      "blockquote",
      "pre",
      "code",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "start"],
  });
  return (
    <div
      className="space-y-2 overflow-x-auto break-words leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:text-lg [&_h2]:text-base [&_:is(h1,h2,h3,h4,h5,h6)]:font-bold [&_ol]:list-decimal [&_ul]:list-disc [&_:is(ol,ul)]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-current/10 [&_pre]:p-2 [&_:is(td,th)]:border [&_:is(td,th)]:px-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
