import DOMPurify from "isomorphic-dompurify";

// Force safe rel values on links that open a new tab.
DOMPurify.addHook("afterSanitizeAttributes", (node: any) => {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Sanitize untrusted HTML before rendering with v-html.
 *
 * Works on both server (jsdom) and client (browser build), so SSR output is
 * already clean and there is no hydration flash.
 */
export const sanitizeHtml = (html: unknown): string => {
  if (html === null || html === undefined || html === "") return "";
  return DOMPurify.sanitize(String(html), {
    ADD_ATTR: ["target"],
  });
};
