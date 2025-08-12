import React from 'react';
import cx from 'classnames';
import { getFontSize, getIconSize } from '@/constants/Font';
import { cssInterop } from 'nativewind';
import { View, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Link } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronRight } from '@fortawesome/pro-solid-svg-icons/faChevronRight'
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import useDevice from '@/hooks/useDevice';


interface ButtonPropsBase {
    btnType?: string | { bg: string, textColor: string },
    title: string;
    titleSize?: 'text-xs' | 'text-sm' | 'text-md' | 'text-lg' | 'text-xl' | 'text-2xl';
    icon?: IconProp;
    iconSize?: number;
    centeredItems?: boolean;
    useChevron?: boolean; 
    containerClassNames?: string
}

interface ButtonPropsWithHref extends ButtonPropsBase {
    href: string | object; // Required if this variant is used
    onPress?: never; // Prevent onPress from being used
}

interface ButtonPropsWithOnPress extends ButtonPropsBase {
    onPress: () => void; // Required if this variant is used
    href?: never; // Prevent href from being used
}

type ButtonProps = ButtonPropsWithHref | ButtonPropsWithOnPress;

cssInterop(FontAwesomeIcon, {
    className: {
      target: "style",
      nativeStyleToProp: { height: true, width: true, size: true },
    },
  });


  const titleSizes = {
    'text-xs':  getFontSize(12),
    'text-sm':  getFontSize(14),
    'text-md':  getFontSize(16),
    'text-lg':  getFontSize(18),
    'text-xl':  getFontSize(20),
    'text-2xl': getFontSize(24),
  }

  const titleLineHeights = {
    'text-xs':  getFontSize(12),
    'text-sm':  getFontSize(14),
    'text-md':  getFontSize(18),
    'text-lg':  getFontSize(18),
    'text-xl':  getFontSize(20),
    'text-2xl': getFontSize(24),
  }

function Button({ btnType = 'secondary', title, titleSize = 'text-lg', icon, iconSize = getIconSize(18), href, useChevron = false, centeredItems = false, onPress, containerClassNames }: ButtonProps) {
    const { isTablet, isPhone } = useDevice();
    
    // Handle custom background colors
    let bgClass = '';
    let textClass = '';
    
    if (typeof btnType === 'object') {
        bgClass = btnType.bg;
        textClass = btnType.textColor;
    } else {
        // Default button types
        switch(btnType) {
            case 'primary':
                bgClass = 'bg-blue-500 dark:bg-blue-300';
                textClass = 'text-white dark:text-white';
                break;
            case 'secondary':
                bgClass = 'bg-white dark:bg-gray-50';
                textClass = 'text-gray-500';
                break;
            case 'login':
                bgClass = 'bg-gray-900 dark:bg-white';
                textClass = 'text-white dark:text-black';
                break;
            case 'logout':
                bgClass = 'bg-peach-500';
                textClass = 'text-black';
                break;
            default:
                bgClass = 'bg-white dark:bg-gray-50';
                textClass = 'text-gray-500';
        }
    }

    const classNames = cx('flex-row items-center rounded-md shadow-sm', containerClassNames, bgClass, {
        'py-3': isPhone,
        'py-4': isTablet,
        'justify-between': !centeredItems,
        'justify-center': centeredItems,
    });

    const iconClassNames = cx(textClass);
    const textClassNames = cx(textClass);

    return (
        <>
            { href && (
                <Link href={href} asChild>
                    <TouchableOpacity className={classNames}>
                    <View className="flex-row items-center text-center">
                        { icon && <View className={cx({'mr-2': isPhone, 'mr-5': isTablet})}><FontAwesomeIcon icon={icon} size={getIconSize(iconSize)} className={iconClassNames} /></View>}
                        <Text className={textClassNames} style={{fontSize: titleSizes[titleSize], lineHeight: titleSizes[titleSize]}}>{title}</Text>
                    </View>
                    { useChevron && (<FontAwesomeIcon icon={faChevronRight} size={getIconSize(20)} color="#00448F" />)}
                    
                    </TouchableOpacity>
                </Link>
            )}
            { !href && onPress && (
                <TouchableOpacity className={classNames} onPress={onPress}>
                <View className="flex-row items-center">
                    { icon && <View  className={cx('bg-red', {'mr-2': isPhone, 'mr-5': isTablet})}><FontAwesomeIcon icon={icon} size={getIconSize(iconSize)} className={iconClassNames} /></View>}
                    <Text className={textClassNames}  style={{fontSize: titleSizes[titleSize], lineHeight: titleLineHeights[titleSize]}} >{title}</Text>
                </View>
                { useChevron && (<FontAwesomeIcon icon={faChevronRight} size={getIconSize(20)} color="#00448F" />)}
                </TouchableOpacity>
        )}
        </>

    );
  }
  

  
  export default Button;