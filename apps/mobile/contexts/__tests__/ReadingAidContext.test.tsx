import * as React from 'react';
import { render, act } from '@testing-library/react';
import { ReadingAidProvider, useReadingAid } from '../ReadingAidContext';
import { useFeatureFlag } from 'posthog-react-native';
import { useAuth } from '../AuthContext';
import useUserSettings from '@/services/api/useUserSettings';

// Mock dependencies
jest.mock('posthog-react-native', () => ({
  useFeatureFlag: jest.fn(),
}));

jest.mock('../AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/api/useUserSettings', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/services/JapaneseTextService', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    readyPromise: Promise.resolve(),
  })),
}));

const TestComponent = () => {
  const readingAid = useReadingAid();
  return (
    <div>
      <div data-testid="isReadingAidFlagEnabled">{readingAid.isReadingAidFlagEnabled.toString()}</div>
      <div data-testid="isJapaneseReadingAidEnabledAndReady">{readingAid.isJapaneseReadingAidEnabledAndReady.toString()}</div>
    </div>
  );
};

describe('ReadingAidContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useFeatureFlag as jest.Mock).mockReturnValue(false);
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: false });
    (useUserSettings as jest.Mock).mockReturnValue({ userSettings: null });
  });

  it('should provide default values when not authenticated', () => {
    const { getByTestId } = render(
      <ReadingAidProvider>
        <TestComponent />
      </ReadingAidProvider>
    );

    expect(getByTestId('isReadingAidFlagEnabled').textContent).toBe('false');
    expect(getByTestId('isJapaneseReadingAidEnabledAndReady').textContent).toBe('false');
  });

  it('should enable reading aid when all conditions are met', async () => {
    (useFeatureFlag as jest.Mock).mockReturnValue(true);
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    (useUserSettings as jest.Mock).mockReturnValue({ 
      userSettings: { 
        team: { 
          stream_language: 'japanese',
          chat_settings: {
            pronunciation_characters: 'romaji'
          }
        }
      } 
    });

    const { getByTestId } = render(
      <ReadingAidProvider>
        <TestComponent />
      </ReadingAidProvider>
    );

    // Initially should be false
    expect(getByTestId('isReadingAidFlagEnabled').textContent).toBe('true');
    expect(getByTestId('isJapaneseReadingAidEnabledAndReady').textContent).toBe('false');

    // Wait for the Japanese text service to be ready
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // After service is ready
    expect(getByTestId('isJapaneseReadingAidEnabledAndReady').textContent).toBe('true');
  });

  it('should not enable reading aid for non-Japanese language', () => {
    (useFeatureFlag as jest.Mock).mockReturnValue(true);
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });

    const { getByTestId } = render(
      <ReadingAidProvider>
        <TestComponent />
      </ReadingAidProvider>
    );

    expect(getByTestId('isReadingAidFlagEnabled').textContent).toBe('true');
    expect(getByTestId('isJapaneseReadingAidEnabledAndReady').textContent).toBe('false');
  });

  it('should throw error when useReadingAid is used outside provider', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const TestErrorComponent = () => {
      useReadingAid();
      return null;
    };

    expect(() => {
      render(<TestErrorComponent />);
    }).toThrow('useReadingAid must be used within a ReadingAidProvider');

    console.error = consoleError;
  });
}); 