import { Tabs } from 'expo-router';
import { Entypo, Feather, Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import CustomTabBarBackground from '@/components/GenericComponents/CustomTabBarBackground';

const BRAND_PRIMARY = '#FE2C55';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const MESSAGES_UNREAD = true; // TODO(step-11): drive from real notifications

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <CustomTabBarBackground />,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
      screenListeners={{
        tabPress: () => {
          (async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {
              // Haptics native module not linked yet (older dev-client).
            }
          })();
        },
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => (
            <Entypo name="home" size={22} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name='friends'
        options={{
          title: 'Catégories',
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid-outline" size={22} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name='newPost'
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.sellButton}>
              <Feather name="plus" size={28} color="#fff" />
            </View>
          )
        }}
      />

      <Tabs.Screen
        name='inbox'
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="chatbubble-outline" size={22} color={color} />
              {MESSAGES_UNREAD ? <View style={styles.notificationDot} /> : null}
            </View>
          )
        }}
      />

      <Tabs.Screen
        name='profile'
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={22} color={color} />
          )
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  sellButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: BRAND_PRIMARY,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FE2C55',
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
  },
});
