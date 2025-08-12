import HelpscoutBeacon from 'react-native-helpscout-beacon';
import { UserUserSettings } from '@/contexts/UserSettingsContext';

const HELPSCOUT_BEACON_ID = '5207bd82-222e-4ba7-b97d-b9a3742168bb';
const SUGGESTED_ARTICLES = [
    '6776cfef912e1b468be799b7',
    '65bd1fa7c2176004001715fe',
    '67d46b255f56b817faec9201',
    '65d774456eede73cccbee2ce',
    '674c5b8a6e0c133741456d60',
    '65bba0e8a421cb0773894bb5'
];

export const initializeHelpScout = async (user: UserUserSettings) => {
  try {
    if (!HelpscoutBeacon) {
      console.warn('HelpscoutBeacon is not available');
      return;
    }

    await HelpscoutBeacon.init(HELPSCOUT_BEACON_ID);

    const fullName = `${user.first_name} ${user.last_name}`.trim();
    await HelpscoutBeacon.identify(user.email, fullName);

    await HelpscoutBeacon.suggestArticles(SUGGESTED_ARTICLES);
  } catch (error) {
    console.error('Failed to initialize Helpscout:', error);
  }
};

export const openHelpScout = async (user?: UserUserSettings) => {
  try {
    if (!HelpscoutBeacon) {
      console.warn('HelpscoutBeacon is not available');
      return;
    }

    if (user?.email) {
      await initializeHelpScout(user);
    }
    await HelpscoutBeacon.open();
  } catch (error) {
    console.error('Failed to open Helpscout:', error);
  }
};

export const openHelpScoutArticle = async (user?: UserUserSettings, articleId: string) => {
  try {
    if (!HelpscoutBeacon) {
      console.warn('HelpscoutBeacon is not available');
      return;
    }

    if (user?.email) {
      await initializeHelpScout(user);
    }
    await HelpscoutBeacon.openArticle(articleId, undefined);
  } catch (error) {
    console.error('Failed to open Helpscout article:', error);
  }
};
