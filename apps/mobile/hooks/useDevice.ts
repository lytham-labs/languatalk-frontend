import { getDeviceType } from '@/constants/Font';

const useDevice = () => {
    const deviceType = getDeviceType();
    const isTablet = deviceType === 'tablet';
    const isPhone = deviceType === 'phone';

    return { isTablet, isPhone };
};


export { useDevice as default};
