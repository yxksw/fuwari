import { writable } from "svelte/store";
import type { SessionResult } from "@/forum/types/api";
import type { ForumUser } from "@/forum/types/user";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/forum/utils/storage";

const TOKEN_STORAGE_KEY = "forum-auth-token";

interface AuthState {
	user: ForumUser | null;
	token: string | null;
	loading: boolean;
	requiresTotp: boolean;
}

function createAuthStore() {
	const initialToken = readLocalStorage<string | null>(TOKEN_STORAGE_KEY, null);
	const { subscribe, update, set } = writable<AuthState>({
		user: null,
		token: initialToken,
		loading: false,
		requiresTotp: false,
	});

	return {
		subscribe,
		setLoading: (loading: boolean) => update((state) => ({ ...state, loading })),
		setSession: (session: SessionResult) => {
			if (session.token) {
				writeLocalStorage(TOKEN_STORAGE_KEY, session.token);
			}

			update((state) => ({
				...state,
				user: session.user,
				token: session.token || state.token,
				requiresTotp: Boolean(session.requiresTotp),
				loading: false,
			}));
		},
		clear: () => {
			removeLocalStorage(TOKEN_STORAGE_KEY);
			set({ user: null, token: null, loading: false, requiresTotp: false });
		},
		getToken: () => readLocalStorage<string | null>(TOKEN_STORAGE_KEY, null),
	};
}

export const forumAuth = createAuthStore();
