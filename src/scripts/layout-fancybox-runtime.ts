import { bindFancybox } from "@utils/fancybox";

const SELECTOR = ".custom-md img, #post-cover img";

// Lazy load fancybox CSS
const loadFancyboxCSS = () => {
	if (document.querySelector('link[href*="fancybox"]')) return;
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = "https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css";
	document.head.appendChild(link);
};

// Only load if images exist
if (document.querySelector(SELECTOR)) {
	loadFancyboxCSS();
	bindFancybox(SELECTOR);
}

window.addEventListener("keydown", (e) => {
	if (e.key !== "Escape") return;
});
