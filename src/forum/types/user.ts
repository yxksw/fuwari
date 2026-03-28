export interface ForumUser {
	id: string;
	username: string;
	displayName?: string;
	avatarUrl?: string;
	bio?: string;
	email?: string;
	role?: string;
	createdAt?: string;
	emailNotifications?: boolean;
	totpEnabled?: boolean;
	verified?: boolean;
}

export interface LoginPayload {
	email: string;
	password: string;
	totpCode?: string;
	turnstileToken?: string;
}

export interface RegisterPayload {
	username: string;
	email: string;
	password: string;
	displayName?: string;
	turnstileToken?: string;
}

export interface ForgotPasswordPayload {
	email: string;
	turnstileToken?: string;
}

export interface ResetPasswordPayload {
	token: string;
	newPassword: string;
	totpCode?: string;
	turnstileToken?: string;
}
