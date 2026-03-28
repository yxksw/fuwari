<script lang="ts">
	import Icon from "@iconify/svelte";
	import ForumMarkdownEditor from "@/components/forum/ForumMarkdownEditor.svelte";
	import { createPost } from "@/forum/api/posts";

	let title = "";
	let content = "";
	let status = "";
	let submitting = false;

	async function submit() {
		if (!title.trim() || !content.trim()) {
			status = "请先填写标题和内容。";
			return;
		}

		submitting = true;
		status = "正在发布...";

		try {
			const result = await createPost({ title: title.trim(), content: content.trim() });
			const postId = String(result.id || "").trim();
			if (!postId) {
				throw new Error("发帖成功，但未拿到帖子 ID");
			}
			status = `发布成功，即将前往帖子 #${postId}`;
			window.location.href = `/forum/post/?id=${encodeURIComponent(postId)}`;
		} catch (error) {
			status = error instanceof Error ? error.message : "发布失败，请稍后重试。";
		} finally {
			submitting = false;
		}
	}
</script>

<div class="card-base space-y-4 p-6 md:p-8">
	<div class="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<div class="mb-2 flex items-center gap-2">
				<Icon icon="material-symbols:edit-square-outline-rounded" class="text-3xl text-[var(--primary)]" />
				<h1 class="text-2xl font-bold text-white">发布帖子</h1>
			</div>
			<p class="text-sm text-white/45">统一使用 Markdown 编辑器，预览与帖子详情页展示效果保持一致。</p>
		</div>
		<div class="flex flex-wrap gap-3">
			<a href="/forum/" class="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/60">返回论坛首页</a>
			<a href="/forum/me/" class="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70">个人中心</a>
		</div>
	</div>
	<div class="space-y-2">
		<label class="text-sm text-white/65" for="forum-post-title">标题</label>
		<input id="forum-post-title" bind:value={title} class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--primary)]" placeholder="输入帖子标题" />
	</div>
	<div class="space-y-2">
		<label class="text-sm text-white/65" for="forum-post-content">内容</label>
		<ForumMarkdownEditor bind:value={content} mode="post" uploadType="post" placeholder="写点什么吧，支持 Markdown 语法..." {submitting} minHeight={320} submitHint="Ctrl/Cmd + Enter 发布" on:submit={submit} />
	</div>
	<div class="flex items-center gap-3">
		<button class="rounded-xl bg-[var(--primary)] px-5 py-3 font-bold text-black/80 transition disabled:opacity-60" disabled={submitting} on:click={submit}>发布</button>
		{#if status}
			<p class="text-sm text-white/55">{status}</p>
		{/if}
	</div>
</div>
