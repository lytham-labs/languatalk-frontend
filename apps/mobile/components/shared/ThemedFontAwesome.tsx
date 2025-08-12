import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

import { cssInterop } from 'nativewind';

cssInterop(FontAwesome6, {
  className: {
    target: "style",
    nativeStyleToProp: { height: true, width: true },
  },
});

export default function ThemedFontAwesome({ name, size, className = "color-peach-500 dark:color-white" }: { name: string; size: number; className?: string | null }) {

    return (
        <FontAwesome6 name={name} size={size} className={className}  />
    )
}