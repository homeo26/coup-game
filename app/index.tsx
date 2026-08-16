/**
 * Tab host — all three tabs (Play / Rules / More) are mounted
 * side-by-side inside a PagerView; nothing unmounts on tab change and
 * swipe navigation works. The Play tab morphs between Home → Lobby →
 * Game following the active room's state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { HomeScreen } from '../src/screens/HomeScreen';
import { LobbyScreen } from '../src/screens/LobbyScreen';
import { GameScreen } from '../src/screens/GameScreen';
import { RulesScreen } from '../src/screens/RulesScreen';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { TabBar } from '../src/components/TabBar';
import { useRoom } from '../src/net/RoomContext';
import { Theme, useStyles } from '../src/theme';

function PlayTab() {
  const { room } = useRoom();
  if (!room) return <HomeScreen />;
  if (room.status === 'lobby') return <LobbyScreen />;
  return <GameScreen />;
}

export default function TabsHost() {
  const styles = useStyles(makeStyles);
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  const { room } = useRoom();

  // Joining/creating a room snaps back to the Play tab.
  const roomCode = room?.code ?? null;
  useEffect(() => {
    if (roomCode) pagerRef.current?.setPage(0);
  }, [roomCode]);

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
        offscreenPageLimit={2}
        onPageSelected={(e) => setPage(e.nativeEvent.position)}
      >
        <View key="play" style={styles.page}>
          <PlayTab />
        </View>
        <View key="rules" style={styles.page}>
          <RulesScreen />
        </View>
        <View key="settings" style={styles.page}>
          <SettingsScreen />
        </View>
      </PagerView>
      <TabBar activeIndex={page} onPress={(i) => pagerRef.current?.setPage(i)} />
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
