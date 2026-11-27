import React, {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  apiGet,
  apiPost,
} from './api';

interface NeoGramFeedAuthor {
  id: number;
  username?: string | null;
  name?: string | null;
  avatar?: string | null;
  is_creator?: number;
  is_creator_badge?: number;
}

interface NeoGramFeedComment {
  id: number;
  text: string;
  created_at?: string;
  author?: NeoGramFeedAuthor;
}

interface NeoGramFeedPost {
  id: number;
  text: string;
  created_at?: string;
  author?: NeoGramFeedAuthor;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_pinned?: boolean;
  comments?: NeoGramFeedComment[];
}

interface NeoGramFeedResponse {
  ok?: boolean;
  posts?: NeoGramFeedPost[];
  feed?: NeoGramFeedPost[];
  official?: {
    title?: string;
    description?: string;
    url?: string;
    avatar?: string;
  };
  next_cursor?: string | null;
}

interface NeoGramFeedTabProps {
  className?: string;
  onCreatePost?: () => void;
}

const OFFICIAL_CHANNEL = {
  title: 'NeoGram — Официальный канал',
  description: 'Новости проекта, обновления, события и важные объявления NeoGram.',
  url: 'https://t.me/',
};

const PAGE_SIZE = 20;

function formatDate(value?: string): string {
  if (!value) return 'только что';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getAuthorName(author?: NeoGramFeedAuthor): string {
  if (!author) return 'Игрок NeoGram';

  return author.name
    || (author.username ? `@${author.username.replace(/^@/, '')}` : '')
    || `Игрок ${author.id}`;
}

function getInitials(name: string): string {
  return name
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'N';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    switch (error.message) {
      case 'UNAUTHORIZED':
        return 'Войдите в аккаунт NeoGram, чтобы пользоваться лентой.';
      case 'NEOGRAM_SERVER_UNAVAILABLE':
        return 'Сервер временно недоступен. Попробуйте позже.';
      default:
        return error.message;
    }
  }

  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

const styles = `
.ng-feed {
  --ng-feed-radius: 16px;
  --ng-feed-gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--color-text);
  background: var(--color-background);
  font-family: inherit;
  box-sizing: border-box;
}

.ng-feed *,
.ng-feed *::before,
.ng-feed *::after {
  box-sizing: border-box;
}

.ng-feed button,
.ng-feed textarea {
  font: inherit;
}

.ng-feed button {
  -webkit-tap-highlight-color: transparent;
}

.ng-feed__header {
  flex-shrink: 0;
  padding: 16px 16px 12px;
  padding-top: max(16px, env(safe-area-inset-top));
  border-bottom: 1px solid var(--color-borders);
  background: var(--color-background);
}

.ng-feed__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ng-feed__heading {
  margin: 0;
  font-size: 23px;
  line-height: 1.25;
  font-weight: 750;
  letter-spacing: -0.5px;
}

.ng-feed__subtitle {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.ng-feed__icon-button {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--color-background-secondary);
  cursor: pointer;
}

.ng-feed__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 12px 12px calc(24px + env(safe-area-inset-bottom));
}

.ng-feed__official {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 15px;
  overflow: hidden;
  border: 1px solid var(--color-borders);
  border-radius: var(--ng-feed-radius);
  background: var(--color-background-secondary);
}

.ng-feed__official::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-primary);
}

.ng-feed__official-avatar {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: white;
  font-size: 23px;
  font-weight: 800;
  background: var(--color-primary);
}

.ng-feed__official-content {
  min-width: 0;
  flex: 1;
}

.ng-feed__official-label {
  margin-bottom: 3px;
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
}

.ng-feed__official-title {
  font-size: 14px;
  font-weight: 750;
  line-height: 1.35;
}

.ng-feed__official-description {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.ng-feed__official-link {
  display: inline-flex;
  margin-top: 8px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}

.ng-feed__section-title {
  margin: 18px 4px 10px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: .5px;
  text-transform: uppercase;
}

.ng-feed__post {
  margin-bottom: 12px;
  padding: 15px;
  border: 1px solid var(--color-borders);
  border-radius: var(--ng-feed-radius);
  background: var(--color-background);
}

.ng-feed__post-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ng-feed__avatar {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--color-background-secondary);
  font-size: 14px;
  font-weight: 800;
}

.ng-feed__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ng-feed__author {
  min-width: 0;
  flex: 1;
}

.ng-feed__author-name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 14px;
  font-weight: 750;
}

.ng-feed__creator {
  padding: 2px 5px;
  border-radius: 5px;
  color: white;
  background: var(--color-primary);
  font-size: 9px;
  font-weight: 850;
}

.ng-feed__date {
  margin-top: 3px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.ng-feed__pinned {
  margin-left: auto;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

.ng-feed__post-text {
  margin: 13px 0 15px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.55;
}

.ng-feed__post-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-top: 11px;
  border-top: 1px solid var(--color-borders);
}

.ng-feed__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 3px 0;
  border: 0;
  color: var(--color-text-secondary);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
}

.ng-feed__action--liked {
  color: #e85d75;
}

.ng-feed__action:disabled {
  opacity: .5;
  cursor: default;
}

.ng-feed__comments {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-borders);
}

.ng-feed__comment {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  line-height: 1.45;
}

.ng-feed__comment-name {
  margin-right: 5px;
  font-weight: 750;
}

.ng-feed__comment-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.ng-feed__comment-input {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 9px 12px;
  border: 1px solid var(--color-borders);
  border-radius: 20px;
  outline: none;
  color: var(--color-text);
  background: var(--color-background-secondary);
  font-size: 12px;
}

.ng-feed__comment-input:focus,
.ng-feed__composer-input:focus {
  border-color: var(--color-primary);
}

.ng-feed__send {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: white;
  background: var(--color-primary);
  cursor: pointer;
}

.ng-feed__create {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 5px;
  padding: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  border: 0;
  border-radius: 14px;
  color: white;
  background: var(--color-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, .13);
  font-size: 14px;
  font-weight: 750;
  cursor: pointer;
}

.ng-feed__create-plus {
  font-size: 23px;
  line-height: 1;
}

.ng-feed__composer {
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid var(--color-borders);
  border-radius: var(--ng-feed-radius);
  background: var(--color-background-secondary);
}

.ng-feed__composer-input {
  width: 100%;
  min-height: 100px;
  resize: vertical;
  padding: 11px;
  border: 1px solid var(--color-borders);
  border-radius: 11px;
  outline: none;
  color: var(--color-text);
  background: var(--color-background);
  font-size: 14px;
  line-height: 1.5;
}

.ng-feed__composer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.ng-feed__counter {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.ng-feed__publish {
  min-height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: 20px;
  color: white;
  background: var(--color-primary);
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.ng-feed__publish:disabled {
  opacity: .45;
  cursor: default;
}

.ng-feed__message {
  padding: 36px 16px;
  color: var(--color-text-secondary);
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
}

.ng-feed__retry {
  display: block;
  margin: 12px auto 0;
  padding: 8px 16px;
  border: 1px solid var(--color-borders);
  border-radius: 20px;
  color: var(--color-primary);
  background: var(--color-background-secondary);
  cursor: pointer;
}

.ng-feed__skeleton {
  height: 145px;
  margin-bottom: 12px;
  border: 1px solid var(--color-borders);
  border-radius: var(--ng-feed-radius);
  background: var(--color-background-secondary);
  opacity: .65;
  animation: ng-feed-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes ng-feed-pulse {
  from { opacity: .35; }
  to { opacity: .75; }
}

@media (prefers-reduced-motion: reduce) {
  .ng-feed__skeleton {
    animation: none;
  }
}
`;

export default function NeoGramFeedTab({
  className,
  onCreatePost,
}: NeoGramFeedTabProps) {
  const [posts, setPosts] = useState<NeoGramFeedPost[]>([]);
  const [official, setOfficial] = useState(OFFICIAL_CHANNEL);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [expandedComments, setExpandedComments] = useState<number[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [busyPosts, setBusyPosts] = useState<number[]>([]);

  const loadFeed = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const response = await apiGet<NeoGramFeedResponse>('/feed', {
        limit: PAGE_SIZE,
      });

      if (response?.ok === false) {
        throw new Error('FEED_LOAD_FAILED');
      }

      const incoming = Array.isArray(response.posts)
        ? response.posts
        : Array.isArray(response.feed)
          ? response.feed
          : [];

      setPosts(incoming);

      if (response.official) {
        setOfficial({
          title: response.official.title || OFFICIAL_CHANNEL.title,
          description: response.official.description || OFFICIAL_CHANNEL.description,
          url: response.official.url || OFFICIAL_CHANNEL.url,
        });
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();

    const handleRefresh = () => {
      void loadFeed(true);
    };

    window.addEventListener('neogram:feed-refresh', handleRefresh);

    return () => {
      window.removeEventListener('neogram:feed-refresh', handleRefresh);
    };
  }, [loadFeed]);

  const openComposer = useCallback(() => {
    if (onCreatePost) {
      onCreatePost();
      return;
    }

    setComposerOpen(true);
  }, [onCreatePost]);

  const publishPost = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = draft.trim();

    if (!text || publishing) return;

    setPublishing(true);

    try {
      await apiPost('/feed/posts', { text });

      setDraft('');
      setComposerOpen(false);
      await loadFeed(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPublishing(false);
    }
  }, [draft, publishing, loadFeed]);

  const toggleLike = useCallback(async (post: NeoGramFeedPost) => {
    if (busyPosts.includes(post.id)) return;

    const wasLiked = Boolean(post.is_liked);

    setBusyPosts((current) => [...current, post.id]);

    setPosts((current) => current.map((item) => (
      item.id === post.id
        ? {
          ...item,
          is_liked: !wasLiked,
          likes_count: Math.max(
            0,
            (item.likes_count || 0) + (wasLiked ? -1 : 1),
          ),
        }
        : item
    )));

    try {
      await apiPost(`/feed/posts/${post.id}/like`, {
        action: wasLiked ? 'unlike' : 'like',
      });
    } catch (requestError) {
      setPosts((current) => current.map((item) => (
        item.id === post.id
          ? {
            ...item,
            is_liked: wasLiked,
            likes_count: Math.max(
              0,
              (item.likes_count || 0) + (wasLiked ? 1 : -1),
            ),
          }
          : item
      )));

      setError(getErrorMessage(requestError));
    } finally {
      setBusyPosts((current) => current.filter((id) => id !== post.id));
    }
  }, [busyPosts]);

  const toggleComments = useCallback(async (post: NeoGramFeedPost) => {
    const isExpanded = expandedComments.includes(post.id);

    setExpandedComments((current) => (
      isExpanded
        ? current.filter((id) => id !== post.id)
        : [...current, post.id]
    ));

    if (!isExpanded && !post.comments) {
      try {
        const response = await apiGet<{
          ok?: boolean;
          comments?: NeoGramFeedComment[];
        }>(`/feed/posts/${post.id}/comments`);

        setPosts((current) => current.map((item) => (
          item.id === post.id
            ? { ...item, comments: response.comments || [] }
            : item
        )));
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      }
    }
  }, [expandedComments]);

  const submitComment = useCallback(async (
    event: FormEvent<HTMLFormElement>,
    post: NeoGramFeedPost,
  ) => {
    event.preventDefault();

    const text = (commentDrafts[post.id] || '').trim();

    if (!text) return;

    try {
      const response = await apiPost<{
        ok?: boolean;
        comment?: NeoGramFeedComment;
      }>(`/feed/posts/${post.id}/comments`, { text });

      setPosts((current) => current.map((item) => (
        item.id === post.id
          ? {
            ...item,
            comments: [
              ...(item.comments || []),
              ...(response.comment ? [response.comment] : [{
                id: Date.now(),
                text,
              }]),
            ],
            comments_count: (item.comments_count || 0) + 1,
          }
          : item
      )));

      setCommentDrafts((current) => ({
        ...current,
        [post.id]: '',
      }));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }, [commentDrafts]);

  const sortedPosts = [...posts].sort((a, b) => (
    Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned))
    || new Date(b.created_at || 0).getTime()
      - new Date(a.created_at || 0).getTime()
  ));

  return (
    <section
      className={`ng-feed ${className || ''}`}
      aria-label="Лента NeoGram"
    >
      <style>{styles}</style>

      <header className="ng-feed__header">
        <div className="ng-feed__header-row">
          <div>
            <h1 className="ng-feed__heading">Лента</h1>
            <div className="ng-feed__subtitle">
              Сообщество NeoGram
            </div>
          </div>

          <button
            type="button"
            className="ng-feed__icon-button"
            aria-label="Обновить ленту"
            disabled={refreshing}
            onClick={() => void loadFeed(true)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 7v5h-5" />
              <path d="M4 17v-5h5" />
              <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12" />
              <path d="M4 12l2.8 5a7 7 0 0 0 11.6-2" />
            </svg>
          </button>
        </div>
      </header>

      <div className="ng-feed__scroll">
        <article className="ng-feed__official">
          <div className="ng-feed__official-avatar">
            {official.avatar ? (
              <img src={official.avatar} alt="" />
            ) : (
              'N'
            )}
          </div>

          <div className="ng-feed__official-content">
            <div className="ng-feed__official-label">
              Закреплённый канал
            </div>

            <div className="ng-feed__official-title">
              {official.title}
            </div>

            <div className="ng-feed__official-description">
              {official.description}
            </div>

            <a
              className="ng-feed__official-link"
              href={official.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть канал →
            </a>
          </div>
        </article>

        {composerOpen && (
          <form
            className="ng-feed__composer"
            onSubmit={publishPost}
          >
            <textarea
              className="ng-feed__composer-input"
              placeholder="Чем хотите поделиться с сообществом?"
              value={draft}
              maxLength={5000}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
            />

            <div className="ng-feed__composer-footer">
              <span className="ng-feed__counter">
                {draft.length}/5000
              </span>

              <button
                type="submit"
                className="ng-feed__publish"
                disabled={!draft.trim() || publishing}
              >
                {publishing ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="ng-feed__message" role="alert">
            {error}

            <button
              type="button"
              className="ng-feed__retry"
              onClick={() => void loadFeed()}
            >
              Повторить
            </button>
          </div>
        )}

        <div className="ng-feed__section-title">
          Публикации сообщества
        </div>

        {loading ? (
          <>
            <div className="ng-feed__skeleton" />
            <div className="ng-feed__skeleton" />
            <div className="ng-feed__skeleton" />
          </>
        ) : !error && sortedPosts.length === 0 ? (
          <div className="ng-feed__message">
            <div style={{ fontSize: 32, marginBottom: 10 }}>
              ✨
            </div>
            Пока здесь нет публикаций.
            <br />
            Станьте первым, кто поделится новостью!
          </div>
        ) : (
          sortedPosts.map((post) => {
            const authorName = getAuthorName(post.author);
            const isCommentsOpen = expandedComments.includes(post.id);

            return (
              <article
                key={post.id}
                className="ng-feed__post"
              >
                <div className="ng-feed__post-header">
                  <div className="ng-feed__avatar">
                    {post.author?.avatar ? (
                      <img src={post.author.avatar} alt="" />
                    ) : (
                      getInitials(authorName)
                    )}
                  </div>

                  <div className="ng-feed__author">
                    <div className="ng-feed__author-name">
                      <span>{authorName}</span>

                      {(post.author?.is_creator || post.author?.is_creator_badge) ? (
                        <span className="ng-feed__creator">
                          CREATOR
                        </span>
                      ) : null}
                    </div>

                    <div className="ng-feed__date">
                      {formatDate(post.created_at)}
                    </div>
                  </div>

                  {post.is_pinned && (
                    <span className="ng-feed__pinned">
                      📌 Закреплено
                    </span>
                  )}
                </div>

                <div className="ng-feed__post-text">
                  {post.text}
                </div>

                <div className="ng-feed__post-actions">
                  <button
                    type="button"
                    className={`ng-feed__action ${post.is_liked ? 'ng-feed__action--liked' : ''}`}
                    disabled={busyPosts.includes(post.id)}
                    aria-label={post.is_liked ? 'Убрать лайк' : 'Поставить лайк'}
                    onClick={() => void toggleLike(post)}
                  >
                    <span style={{ fontSize: 17 }}>
                      {post.is_liked ? '♥' : '♡'}
                    </span>
                    <span>{post.likes_count || 0}</span>
                  </button>

                  <button
                    type="button"
                    className="ng-feed__action"
                    aria-expanded={isCommentsOpen}
                    onClick={() => void toggleComments(post)}
                  >
                    <span style={{ fontSize: 16 }}>◯</span>
                    <span>
                      {post.comments_count || post.comments?.length || 0} комментариев
                    </span>
                  </button>
                </div>

                {isCommentsOpen && (
                  <div className="ng-feed__comments">
                    {(post.comments || []).map((comment) => (
                      <div
                        className="ng-feed__comment"
                        key={comment.id}
                      >
                        <div>
                          <span className="ng-feed__comment-name">
                            {getAuthorName(comment.author)}
                          </span>
                          <span>{comment.text}</span>
                        </div>
                      </div>
                    ))}

                    {post.comments?.length === 0 && (
                      <div className="ng-feed__message" style={{ padding: 10 }}>
                        Комментариев пока нет.
                      </div>
                    )}

                    <form
                      className="ng-feed__comment-form"
                      onSubmit={(event) => void submitComment(event, post)}
                    >
                      <input
                        className="ng-feed__comment-input"
                        placeholder="Написать комментарий..."
                        maxLength={1000}
                        value={commentDrafts[post.id] || ''}
                        onChange={(event) => setCommentDrafts((current) => ({
                          ...current,
                          [post.id]: event.target.value,
                        }))}
                      />

                      <button
                        type="submit"
                        className="ng-feed__send"
                        aria-label="Отправить комментарий"
                        disabled={!(commentDrafts[post.id] || '').trim()}
                      >
                        ↑
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })
        )}

        <button
          type="button"
          className="ng-feed__create"
          onClick={openComposer}
        >
          <span className="ng-feed__create-plus">+</span>
          <span>Создать публикацию</span>
        </button>
      </div>
    </section>
  );
}
