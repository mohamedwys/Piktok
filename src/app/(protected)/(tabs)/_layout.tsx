import { Tabs } from 'expo-router';
import { Entypo, Feather, Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
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
              <Feather name="plus" size={26} color="#fff" />
            </View>
          )
        }}
      />

      <Tabs.Screen
        name='inbox'
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-outline" size={22} color={color} />
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FE2C55',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
