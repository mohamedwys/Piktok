import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
const SHARD_SIZE = 1800;

async function getSharded(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(`${key}__0`);
  if (head === null) return null;
  let i = 1;
  let out = head;
  while (true) {
    const piece = await SecureStore.getItemAsync(`${key}__${i}`);
    if (piece === null) break;
    out += piece;
    i++;
  }
  return out;
}

async function setSharded(key: string, value: string): Promise<void> {
  await clearSharded(key);
  for (let i = 0; i * SHARD_SIZE < value.length; i++) {
    await SecureStore.setItemAsync(
      `${key}__${i}`,
      value.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE),
    );
  }
}

async function clearSharded(key: string): Promise<void> {
  for (let i = 0; ; i++) {
    const k = `${key}__${i}`;
    const v = await SecureStore.getItemAsync(k);
    if (v === null) break;
    await SecureStore.deleteItemAsync(k);
  }
}

export const secureStorage = isNative
  ? {
      getItem: (k: string) => getSharded(k),
      setItem: (k: string, v: string) => setSharded(k, v),
      removeItem: (k: string) => clearSharded(k),
    }
  : AsyncStorage;
