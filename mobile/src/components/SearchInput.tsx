import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

export interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search...',
  style,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: isFocused ? colors.ink : colors.border,
          borderRadius: radii.input,
          paddingHorizontal: 12,
          height: 44,
        },
        style,
      ]}
    >
      <Search
        size={17}
        color={isFocused ? colors.ink : colors.muted}
        strokeWidth={1.8}
        style={{ marginRight: 8 }}
      />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          flex: 1,
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
          paddingVertical: 0,
        }}
        accessibilityRole="search"
        {...rest}
      />

      {value ? (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          accessibilityLabel="Clear search"
          style={{
            padding: 4,
            borderRadius: 12,
            backgroundColor: colors.divider,
            marginLeft: 4,
          }}
        >
          <X size={13} color={colors.muted} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
};
