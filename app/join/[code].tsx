/**
 * Deep-link landing route: coupgame://join/ABCD and the hosted
 * https://coup-game-rooms.web.app/join/ABCD both arrive here. We stash the
 * code and bounce to the tab host, which joins (or pre-fills) it.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { setPendingJoin } from '../../src/net/deeplink';

export default function JoinRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  if (code) setPendingJoin(String(code));
  return <Redirect href="/" />;
}
