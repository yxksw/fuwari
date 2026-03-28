import { derived, writable } from "svelte/store";
import type { ForumApiEnv } from "@/forum/types/api";
import { readLocalStorage, writeLocalStorage } from "@/forum/utils/storage";

export const FORUM_API_ENV_STORAGE_KEY = "forum-api-env";
export const FORUM_API_CUSTOM_BASE_URL_STORAGE_KEY = "forum-api-custom-base-url";

export const FORUM_API_BASE_URLS: Record<ForumApiEnv, string> = {
	prod: "https://i.2x.nz",
	dev: "http://127.0.0.1:8788",
};

function normalizeBaseUrl(value: string) {
	return value.trim().replace(/\/+$/, "");
}

function createEnvStore() {
	const initialEnv = readLocalStorage<ForumApiEnv>(FORUM_API_ENV_STORAGE_KEY, "prod");
	const initialCustomBaseUrl = readLocalStorage<string>(
		FORUM_API_CUSTOM_BASE_URL_STORAGE_KEY,
		FORUM_API_BASE_URLS[initialEnv],
	);
	const envStore = writable<ForumApiEnv>(initialEnv);
	const customBaseUrlStore = writable<string>(normalizeBaseUrl(initialCustomBaseUrl));

	customBaseUrlStore.subscribe((value) => {
		writeLocalStorage(FORUM_API_CUSTOM_BASE_URL_STORAGE_KEY, normalizeBaseUrl(value));
	});

	const baseUrl = derived([envStore, customBaseUrlStore], ([$env, $customBaseUrl]) => {
		const normalizedCustomBaseUrl = normalizeBaseUrl($customBaseUrl);
		return normalizedCustomBaseUrl || FORUM_API_BASE_URLS[$env];
	});

	return {
		subscribe: envStore.subscribe,
		baseUrl,
		customBaseUrl: {
			subscribe: customBaseUrlStore.subscribe,
			set: (value: string) => customBaseUrlStore.set(normalizeBaseUrl(value)),
			reset: (env: ForumApiEnv) => customBaseUrlStore.set(FORUM_API_BASE_URLS[env]),
		},
		set: (value: ForumApiEnv) => {
			writeLocalStorage(FORUM_API_ENV_STORAGE_KEY, value);
			envStore.set(value);
			customBaseUrlStore.set(FORUM_API_BASE_URLS[value]);
		},
		toggle: () => {
			let nextEnv: ForumApiEnv = "prod";
			envStore.update((current) => {
				nextEnv = current === "prod" ? "dev" : "prod";
				writeLocalStorage(FORUM_API_ENV_STORAGE_KEY, nextEnv);
				return nextEnv;
			});
			customBaseUrlStore.set(FORUM_API_BASE_URLS[nextEnv]);
		},
		getBaseUrl: (env: ForumApiEnv) => FORUM_API_BASE_URLS[env],
	};
}

export const forumEnv = createEnvStore();
