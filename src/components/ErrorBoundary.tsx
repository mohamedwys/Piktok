import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import i18n from '@/i18n';
import { colors } from '@/theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Phase 9 wires Sentry.captureException(error, { extra: info }) here.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorBoundary]', error.message, info.componentStack);
    }
  }

  handleRetry = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{i18n.t('error.boundary.title')}</Text>
          <Text style={styles.message}>{i18n.t('error.boundary.message')}</Text>
          <Text style={styles.detail}>{this.state.error.message}</Text>
          <Pressable
            onPress={this.handleRetry}
            style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          >
            <Text style={styles.retryText}>{i18n.t('error.boundary.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  message: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  detail: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 24, textAlign: 'center' },
  retry: { backgroundColor: colors.brand, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  retryPressed: { opacity: 0.85 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
