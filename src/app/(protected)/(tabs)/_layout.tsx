import { Tabs } from 'expo-router';
import { Entypo, Feather, Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import CustomTabBarBackground from '@/components/GenericComponents/CustomTabBarBackground';

const BRAND_PRIMARY = '#FE2C55';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const MESSAGES_UNREAD = true; // TODO(step-11): drive from real notifications

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <CustomTabBarBackground />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 4 },
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
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => (
            <Entypo name="home" size={24} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name='friends'
        options={{
          title: t('tabs.categories'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid-outline" size={24} color={color} />
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
          title: t('tabs.messages'),
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="chatbubble-outline" size={24} color={color} />
              {MESSAGES_UNREAD ? <View style={styles.notificationDot} /> : null}
            </View>
          )
        }}
      />

      <Tabs.Screen
        name='profile'
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={24} color={color} />
          )
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  sellButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    shadowColor: BRAND_PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
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
