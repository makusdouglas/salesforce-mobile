import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';

import { useHasRole } from '@/features/auth';

import { AdminStack } from './AdminStack';
import { HomeStack } from './HomeStack';
import type { RootTabsParamList } from './types';

const Tabs = createBottomTabNavigator<RootTabsParamList>();

function HomeTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.iconDot, focused && styles.iconDotActive]} />
  );
}

function AdminTabIcon({ focused }: { focused: boolean }) {
  return (
    <Text style={[styles.iconGlyph, focused && styles.iconGlyphActive]}>⚙︎</Text>
  );
}

export function RootTabs() {
  const isAdmin = useHasRole('admin');

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        // Hide the tab bar entirely when there's only one visible tab so
        // seller-only users see no change to their layout (UX6).
        tabBarStyle: isAdmin ? styles.tabBar : { display: 'none' },
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: '#09090B',
        tabBarInactiveTintColor: '#71717A',
      }}
    >
      <Tabs.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          title: 'Início',
          tabBarIcon: HomeTabIcon,
        }}
      />
      {isAdmin ? (
        <Tabs.Screen
          name="AdminTab"
          component={AdminStack}
          options={{
            title: 'Admin',
            tabBarIcon: AdminTabIcon,
          }}
        />
      ) : null}
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  tabLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500' },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A1A1AA',
  },
  iconDotActive: { backgroundColor: '#09090B' },
  iconGlyph: { color: '#A1A1AA', fontSize: 16 },
  iconGlyphActive: { color: '#09090B' },
});
