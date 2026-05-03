import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

export type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  helper?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  placeholder?: string;
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
};

export function FormField({
  label,
  value,
  onChangeText,
  error,
  helper,
  required = false,
  multiline = false,
  maxLength,
  keyboardType,
  autoCapitalize,
  placeholder,
  autoCorrect,
  secureTextEntry = false,
  textContentType,
}: FormFieldProps): React.ReactElement {
  const hasError = Boolean(error);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text variant="label" color="secondary">
          {label}
          {required ? (
            <Text variant="label" style={{ color: colors.brand }}>
              {' *'}
            </Text>
          ) : null}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          hasError && styles.inputError,
        ]}
      />
      {(error || helper) ? (
        <View style={styles.helperRow}>
          {error ? (
            <Text
              variant="caption"
              style={{ color: colors.feedback.danger, flex: 1 }}
            >
              {error}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {helper ? (
            <Text variant="caption" color="tertiary">
              {helper}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.feedback.danger,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

export default FormField;
