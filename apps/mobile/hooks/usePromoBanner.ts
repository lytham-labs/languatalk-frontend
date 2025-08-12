import { useState } from 'react';
import { Platform } from 'react-native';

export function usePromoBanner(isFreeUser: boolean): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
    const isIOS = Platform.OS === 'ios';
    const [showPromoCodeModal, setShowPromoCodeModal] = useState((isFreeUser && isIOS) as boolean);

    return [showPromoCodeModal, setShowPromoCodeModal];
}
