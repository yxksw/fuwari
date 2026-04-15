import { Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

const fancyboxOptions: any = {
	hideScrollbar: false,
	zoomEffect: false,
	showClass: "f-fadeIn",
	hideClass: "f-fadeOut",
	wheel: "zoom",
	clickContent: "close",
	dblclickContent: "zoom",
	click: "close",
	dblclick: "zoom",
	Panels: {
		display: ["counter", "zoom"],
	},
	Images: {
		panning: true,
		zoom: true,
		protect: false,
	},
};

export function bindFancybox(selector: string): void {
	Fancybox.bind(selector, fancyboxOptions);
}

export function closeFancybox(): void {
	try {
		Fancybox.close();
	} catch {}
}

export function cleanupFancybox(): void {
	closeFancybox();
	document
		.querySelectorAll(".fancybox__container")
		.forEach((el) => el.remove());
}

export { fancyboxOptions };
