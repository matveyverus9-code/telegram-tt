import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { RegularLangKey } from '../../../types/language';
import { type AnimationLevel, GlobalSearchContent } from '../../../types';
import { selectTabState } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { parseDateString } from '../../../util/dates/dateMath';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import Island from '../../gili/layout/Island';

import AudioResults from './AudioResults';
import BotAppResults from './BotAppResults';
import ChatMessageResults from './ChatMessageResults';
import ChatResults from './ChatResults';
import FileResults from './FileResults';
import LinkResults from './LinkResults';
import MediaResults from './MediaResults';
import PublicPostsResults from './PublicPostsResults';
import LeftSearchResultChat from './LeftSearchResultChat';

import {
  getNeoGramPlayerAccessHash,
  getNeoGramPlayerId,
  getNeoGramPlayerName,
  getNeoGramPlayerPhone,
  getNeoGramPlayerUsername,
  searchNeoGramPlayers,
  type NeoGramSearchPlayer,
} from '../../../neogram/player-search';
import { decorateTelegramPeer } from '../../../neogram/player-peer';

import './LeftSearch.scss';

export type OwnProps = {
  searchQuery?: string;
  searchDate?: number;
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  currentContent?: GlobalSearchContent;
  chatId?: string;
  animationLevel: AnimationLevel;
};

type TabInfo = {
  type: GlobalSearchContent;
  key: RegularLangKey;
};

const TABS: TabInfo[] = [
  { type: GlobalSearchContent.ChatList, key: 'SearchTabChats' },
  { type: GlobalSearchContent.ChannelList, key: 'SearchTabChannels' },
  { type: GlobalSearchContent.BotApps, key: 'SearchTabApps' },
  { type: GlobalSearchContent.PublicPosts, key: 'SearchTabPublicPosts' },
  { type: GlobalSearchContent.Media, key: 'SearchTabMedia' },
  { type: GlobalSearchContent.Links, key: 'SearchTabLinks' },
  { type: GlobalSearchContent.Files, key: 'SearchTabFiles' },
  { type: GlobalSearchContent.Music, key: 'SearchTabMusic' },
  { type: GlobalSearchContent.Voice, key: 'SearchTabVoice' },
];

const CHAT_TABS: TabInfo[] = [
  { type: GlobalSearchContent.ChatList, key: 'SearchTabMessages' },
  ...TABS.slice(3),
];

function buildNeoGramApiUser(
  player: NeoGramSearchPlayer,
): { id: string; user: ApiUser } | undefined {
  const id = getNeoGramPlayerId(player);

  // Для регистрации Telegram-пользователя нужен числовой Telegram ID.
  if (!id || !/^user\d+$/.test(id)) {
    return undefined;
  }

  const username = getNeoGramPlayerUsername(player);
  const accessHash = getNeoGramPlayerAccessHash(player);
  const phoneNumber = getNeoGramPlayerPhone(player);

  const fullName = getNeoGramPlayerName(player);
  const firstName = player.first_name || fullName;

  const apiUser: ApiUser = {
    id,
    type: 'userTypeRegular',

    // Не позволяем частичным данным NeoGram перезаписать
    // полноценный Telegram-профиль.
    isMin: true,

    firstName,
    lastName: player.last_name || undefined,
    phoneNumber: phoneNumber || '',
    accessHash,

    usernames: username
      ? [{
        username,
        isActive: true,
      }]
      : undefined,

    hasUsername: Boolean(username),
  };

  return {
    id,
    user: decorateTelegramPeer(apiUser) as ApiUser,
  };
}

const LeftSearch = ({
  searchQuery,
  searchDate,
  isActive,
  currentContent = GlobalSearchContent.ChatList,
  chatId,
  animationLevel,
  onReset,
}: OwnProps & StateProps) => {
  const {
    setGlobalSearchContent,
    setGlobalSearchDate,
    checkSearchPostsFlood,
    apiUpdate,
    openChat,
    addRecentlyFoundChatId,
  } = getActions();

  const lang = useLang();

  const dateSearchQuery = useMemo(
    () => parseDateString(searchQuery),
    [searchQuery],
  );

  const [neoGramPlayers, setNeoGramPlayers] = useState<NeoGramSearchPlayer[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (isActive) {
      checkSearchPostsFlood({});
    }
  }, [isActive]);

  const tabs = useMemo(() => {
    const arr = chatId ? CHAT_TABS : TABS;

    return arr.map((tab) => ({
      ...tab,
      title: lang(tab.key),
    }));
  }, [chatId, lang]);

  const activeTab = Math.max(
    0,
    tabs.findIndex((tab) => tab.type === currentContent),
  );

  const activeContent = tabs[activeTab]?.type ?? currentContent;

  const handleSwitchTab = useLastCallback((index: number) => {
    const tab = tabs[index];
    setGlobalSearchContent({ content: tab.type });
  });

  const handleSearchDateSelect = useLastCallback((value: Date) => {
    setGlobalSearchDate({
      date: value.getTime() / 1000,
    });
  });

  /**
   * Поиск игроков NeoGram.
   *
   * Полученные пользователи регистрируются в обычном
   * Telegram global state и отображаются штатным компонентом.
   */
  useEffect(() => {
    const query = searchQuery?.trim();

    const isNeoGramQuery = Boolean(
      query
      && (
        query.startsWith('@')
        || query.startsWith('#')
        || /^\+?\d/.test(query)
      ),
    );

    if (
      !isActive
      || chatId
      || activeContent !== GlobalSearchContent.ChatList
      || !query
      || !isNeoGramQuery
    ) {
      requestIdRef.current += 1;
      setNeoGramPlayers([]);
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    let isCancelled = false;

    const timeout = window.setTimeout(async () => {
      try {
        const players = await searchNeoGramPlayers(query);

        if (isCancelled || requestId !== requestIdRef.current) {
          return;
        }

        const validPlayers = players.filter((player) => {
          return Boolean(buildNeoGramApiUser(player));
        });

        validPlayers.forEach((player) => {
          const result = buildNeoGramApiUser(player);

          if (!result) return;

          apiUpdate({
            '@type': 'updateUser',
            id: result.id,
            user: result.user,
          });
        });

        setNeoGramPlayers(validPlayers);
      } catch {
        if (!isCancelled && requestId === requestIdRef.current) {
          setNeoGramPlayers([]);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchQuery, isActive, chatId, activeContent]);

  const handleNeoGramPlayerClick = useLastCallback((id: string) => {
    openChat({
      id,
      shouldReplaceHistory: true,
    });

    addRecentlyFoundChatId({ id });
    onReset();
  });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const containerRef = useRef<HTMLDivElement>();

  const handleKeyDown = useKeyboardListNavigation(
    containerRef,
    isActive,
    undefined,
    '.ListItem-button',
    true,
  );

  return (
    <div
      className="LeftSearch"
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <TabList
        key={chatId ? 'inChat' : 'global'}
        className="left-search-tab-list"
        activeTab={activeTab}
        tabs={tabs}
        onSwitchTab={handleSwitchTab}
        withFadeMask
      />

      <Transition
        name={resolveTransitionName(
          'slideOptimized',
          animationLevel,
          undefined,
          lang.isRtl,
        )}
        renderCount={tabs.length}
        activeKey={activeContent}
      >
        {(() => {
          switch (activeContent) {
            case GlobalSearchContent.ChatList:
            case GlobalSearchContent.ChannelList:
              if (chatId) {
                return (
                  <ChatMessageResults
                    searchQuery={searchQuery}
                    dateSearchQuery={dateSearchQuery}
                    onReset={onReset}
                    onSearchDateSelect={handleSearchDateSelect}
                  />
                );
              }

              return (
                <>
                  {activeContent === GlobalSearchContent.ChatList
                    && Boolean(neoGramPlayers.length)
                    && (
                      <Island className="search-island search-section">
                        <h3
                          className="section-heading"
                          dir={lang.isRtl ? 'auto' : undefined}
                        >
                          NeoGram
                        </h3>

                        {neoGramPlayers.map((player) => {
                          const result = buildNeoGramApiUser(player);

                          if (!result) return undefined;

                          return (
                            <LeftSearchResultChat
                              key={result.id}
                              chatId={result.id}
                              withUsername
                              onClick={handleNeoGramPlayerClick}
                            />
                          );
                        })}
                      </Island>
                    )}

                  <ChatResults
                    isChannelList={
                      activeContent === GlobalSearchContent.ChannelList
                    }
                    searchQuery={searchQuery}
                    searchDate={searchDate}
                    dateSearchQuery={dateSearchQuery}
                    onReset={onReset}
                    onSearchDateSelect={handleSearchDateSelect}
                  />
                </>
              );

            case GlobalSearchContent.Media:
              return <MediaResults searchQuery={searchQuery} />;

            case GlobalSearchContent.Links:
              return <LinkResults searchQuery={searchQuery} />;

            case GlobalSearchContent.Files:
              return <FileResults searchQuery={searchQuery} />;

            case GlobalSearchContent.Music:
              return (
                <AudioResults
                  key="audio"
                  searchQuery={searchQuery}
                />
              );

            case GlobalSearchContent.Voice:
              return (
                <AudioResults
                  key="voice"
                  isVoice
                  searchQuery={searchQuery}
                />
              );

            case GlobalSearchContent.BotApps:
              return (
                <BotAppResults
                  key="botApps"
                  searchQuery={searchQuery}
                />
              );

            case GlobalSearchContent.PublicPosts:
              return (
                <PublicPostsResults
                  key="publicPosts"
                  searchQuery={searchQuery}
                />
              );

            default:
              return undefined;
          }
        })()}
      </Transition>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { currentContent, chatId } = selectTabState(global).globalSearch;
    const { animationLevel } = selectSharedSettings(global);

    return {
      currentContent,
      chatId,
      animationLevel,
    };
  },
)(LeftSearch));
