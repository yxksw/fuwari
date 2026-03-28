import MarkdownIt from "markdown-it";
import { parse as parseHtml } from "node-html-parser";
import sanitizeHtml from "sanitize-html";

const markdown = MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
});

const sanitizeOptions: sanitizeHtml.IOptions = {
	allowedTags: sanitizeHtml.defaults.allowedTags.concat([
		"img",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"pre",
		"code",
		"blockquote",
		"hr",
		"table",
		"thead",
		"tbody",
		"tr",
		"th",
		"td",
	]),
	allowedAttributes: {
		...sanitizeHtml.defaults.allowedAttributes,
		a: ["href", "name", "target", "rel"],
		img: ["src", "alt", "title", "loading", "referrerpolicy"],
		code: ["class"],
	},
	allowedSchemes: ["http", "https", "mailto"],
};

export function renderForumMarkdown(markdownText?: string) {
	if (!markdownText) {
		return "";
	}

	const renderedHtml = markdown.render(markdownText);
	return sanitizeHtml(renderedHtml, sanitizeOptions);
}

export function extractFirstImageUrlFromMarkdown(markdownText?: string) {
	if (!markdownText) {
		return undefined;
	}

	const renderedHtml = renderForumMarkdown(markdownText);
	if (!renderedHtml) {
		return undefined;
	}

	const html = parseHtml(renderedHtml);
	return html.querySelector("img")?.getAttribute("src") || undefined;
}
