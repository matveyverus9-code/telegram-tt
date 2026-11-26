import {
  memo,
  useEffect,
  useMemo,
  useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

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

import AudioResults from './AudioResults';
import BotAppResults from './BotAppResults';
import ChatMessageResults from './ChatMessageResults';
import ChatResults from './ChatResults';
import FileResults from './FileResults';
import LinkResults from './LinkResults';
import MediaResults from './MediaResults';
import PublicPostsResults from './PublicPostsResults';

import './LeftSearch.scss';

import { searchPlayer } from '../../../neogram/api';

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
  } = getActions();

  const lang = useLang();

  const dateSearchQuery = useMemo(
    () => parseDateString(searchQuery),
    [searchQuery],
  );

  const neoGramResultsRef = useRef<HTMLDivElement>();
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

  useEffect(() => {
    const query = searchQuery?.trim();

    if (
      !isActive
      || chatId
      || activeContent !== GlobalSearchContent.ChatList
      || !query
    ) {
      if (neoGramResultsRef.current) {
        neoGramResultsRef.current.replaceChildren();
      }

      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;

    const isNeoGramQuery = (
      query.startsWith('@')
      || query.startsWith('#')
      || /^\+?\d/.test(query)
    );

    if (!isNeoGramQuery) {
      neoGramResultsRef.current?.replaceChildren();
      return;
    }

    let isCancelled = false;

    const search = async () => {
      try {
        const response = await searchPlayer<Record<string, unknown>>(query);

        if (
          isCancelled
          || requestId !== requestIdRef.current
          || !neoGramResultsRef.current
        ) {
          return;
        }

        const container = neoGramResultsRef.current;

        container.replaceChildren();

        const data = response.data;

        if (!Array.isArray(data)) {
          return;
        }

        const validPlayers = data.filter(
          (player): player is Record<string, unknown> => (
            !!player && typeof player === 'object'
          ),
        );

        if (!validPlayers.length) return;

        const section = document.createElement('section');
        section.className = 'Island search-island search-section';

        const heading = document.createElement('h3');
        heading.className = 'section-heading';
        heading.textContent = 'NeoGram';

        section.appendChild(heading);

        validPlayers.forEach((player) => {
          const row = document.createElement('div');

          row.className = 'ListItem search-result';

          const info = document.createElement('div');
          info.className = 'ListItem-main';

          const name = document.createElement('div');
          name.className = 'ListItem-title';

          const fullName = [
            player.first_name,
            player.last_name,
          ]
            .filter(Boolean)
            .join(' ');

          name.textContent = String(
            player.name
            || fullName
            || player.username
            || 'Игрок NeoGram',
          );

          const subtitle = document.createElement('div');
          subtitle.className = 'ListItem-subtitle';

          const username = player.username || player.user;

          subtitle.textContent = username
            ? `@${String(username).replace(/^@/, '')}`
            : `#${player.id ?? player.user_id ?? '—'}`;

          info.append(name, subtitle);
          row.appendChild(info);
          section.appendChild(row);
        });

        container.appendChild(section);
      } catch {
        if (
          !isCancelled
          && requestId === requestIdRef.current
        ) {
          neoGramResultsRef.current?.replaceChildren();
        }
      }
    };

    const timeout = window.setTimeout(search, 350);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchQuery, isActive, chatId, activeContent]);

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
                  <div ref={neoGramResultsRef} />

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
