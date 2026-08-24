/**
 * Tab host — all three tabs (Play / Rules / More) are mounted
 * side-by-side inside a PagerView; nothing unmounts on tab change and
 * swipe navigation works. The Play tab morphs between Home → Lobby →
 * Game following the active room's state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { ChatScreen } from '../src/screens/ChatScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { LobbyScreen } from '../src/screens/LobbyScreen';
import { GameScreen } from '../src/screens/GameScreen';
import { RulesScreen } from '../src/screens/RulesScreen';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { TabBar } from '../src/components/TabBar';
import { useRoom } from '../src/net/RoomContext';
import { useSettings } from '../src/settings';
import * as music from '../src/music';
import * as sound from '../src/sound';
import { Theme, useStyles } from '../src/theme';

function PlayTab() {
  const { room } = useRoom();
  const stage = !room ? 'home' : room.status === 'lobby' ? 'lobby' : 'game';
  return (
    <Animated.View key={stage} entering={FadeIn.duration(380)} style={{ flex: 1 }}>
      {stage === 'home' ? <HomeScreen /> : stage === 'lobby' ? <LobbyScreen /> : <GameScreen />}
    </Animated.View>
  );
}

export default function TabsHost() {
  const styles = useStyles(makeStyles);
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  const [chatSeen, setChatSeen] = useState(0);
  const { room, myId } = useRoom();
  const { music: musicOn } = useSettings();

  // Joining/creating a room snaps back to the Play tab.
  const roomCode = room?.code ?? null;
  useEffect(() => {
    if (roomCode) pagerRef.current?.setPage(0);
    setChatSeen(0);
  }, [roomCode]);

  // Preload every sound once, so the first cue never gets swallowed.
  useEffect(() => {
    sound.warmup();
  }, []);

  // The table gets the driving heist track; menus keep the calm inn loop.
  const scene: music.Scene = room?.status === 'playing' ? 'table' : 'menu';
  useEffect(() => {
    music.setScene(scene);
  }, [scene]);

  // Music plays everywhere in the app (home included) while the toggle
  // is on, and pauses whenever the app goes to the background.
  useEffect(() => {
    if (musicOn) music.start(scene);
    else music.stop();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (musicOn) music.start(scene);
      } else {
        music.stop();
      }
    });
    // watchdog: sound effects and focus changes can stop the loop
    const tick = setInterval(() => {
      if (musicOn && AppState.currentState === 'active') music.ensurePlaying();
    }, 4000);
    return () => {
      sub.remove();
      clearInterval(tick);
      music.stop();
    };
  }, [musicOn]);

  // Unread chat: everything after the last time the chat tab was open.
  const chatLen = room?.chat.length ?? 0;
  useEffect(() => {
    if (page === 1) setChatSeen(chatLen);
  }, [page, chatLen]);
  const lastMsg = chatLen > 0 ? room!.chat[chatLen - 1] : null;
  const prevLen = useRef(chatLen);
  useEffect(() => {
    // ping for incoming messages while the chat tab is closed
    if (chatLen > prevLen.current && page !== 1 && lastMsg && lastMsg.u !== myId) {
      sound.play('chat');
    }
    prevLen.current = chatLen;
  }, [chatLen, page, lastMsg, myId]);
  const chatBadge = page === 1 ? 0 : Math.max(0, chatLen - chatSeen);

  // Android hardware back: return to the Play tab first, then exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page !== 0) {
        pagerRef.current?.setPage(0);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [page]);

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        offscreenPageLimit={3}
        onPageSelected={(e) => setPage(e.nativeEvent.position)}
      >
        <View key="play" style={styles.page}>
          <PlayTab />
        </View>
        <View key="chat" style={styles.page}>
          <ChatScreen />
        </View>
        <View key="rules" style={styles.page}>
          <RulesScreen />
        </View>
        <View key="settings" style={styles.page}>
          <SettingsScreen />
        </View>
      </PagerView>
      <TabBar
        activeIndex={page}
        onPress={(i) => pagerRef.current?.setPage(i)}
        showChat={!!room}
        chatBadge={chatBadge}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    pager: {
      flex: 1,
    },
    page: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
