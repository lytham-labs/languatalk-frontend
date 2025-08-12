import React from 'react';
import { render, act, getByTestId, waitFor } from '@testing-library/react';
import { ChatDataProvider, useChatData } from '../ChatDataContext';
import { ReadingAidProvider } from '../ReadingAidContext';
import { processMessage, processMessages } from '@/utils/textProcessingUtils';
import { mockMessages, mockChatData, mockChatDataNoMessages } from './__mocks__/chatData';

// Mock the JapaneseTextService to prevent asset loading issues
jest.mock('@/services/JapaneseTextService', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    readyPromise: Promise.resolve(),
    processText: jest.fn().mockResolvedValue([]),
    isServiceLanguage: jest.fn().mockReturnValue(false),
  })),
}));

// Mock expo-asset to prevent loading issues
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({ uri: 'mock-asset-uri' })),
  },
}));

// Mock posthog to prevent feature flag issues
jest.mock('posthog-react-native', () => ({
  useFeatureFlag: jest.fn(() => false),
}));

// Mock user settings hook
jest.mock('@/services/api/useUserSettings', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    userSettings: {
      team: {
        stream_language: 'english',
        chat_settings: {
          pronunciation_characters: 'disabled'
        }
      }
    }
  })),
}));

// Mock auth context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock the text processing utilities
jest.mock('@/utils/textProcessingUtils', () => ({
  processMessage: jest.fn().mockImplementation(async (language: string, message: any) => ({
    ...message,
    processed_at: new Date().toISOString(),
    lines: [{
      text: message.content,
      segments: []
    }]
  })),
  processMessages: jest.fn().mockImplementation(async (language: string, messages: any[]) => 
    messages.map(msg => ({
      ...msg,
      processed_at: new Date().toISOString(),
      lines: msg.content.split('\n').map((line: string) => ({
        text: line,
        segments: []
      }))
    }))
  ),
}));

// Mock the AuthContext
jest.mock('../AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 1 },
    isAuthenticated: true,
    token: 'mock-token'
  })
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

// Mock the API constants
jest.mock('@/constants/api', () => ({
  API_URL: 'https://test-api.com',
}));

// Mock TranscriptionOptions
jest.mock('@/constants/TranscriptionOptions', () => ({
  getTranscriptionModel: jest.fn((mode: string) => `model-${mode}`),
}));

// Test component that uses the context
const TestComponent = () => {
  const { state, addMessage, addMessages, updateMessages } = useChatData();
  console.log("******** STATE Processing Messages: ", state?.isProcessingMessages);
  return (
    <div>
      <div data-testid="isProcessing">{state?.isProcessingMessages.toString()}</div>
      <div data-testid="messageCount">{state?.displayMessages?.length}</div>
      <div data-testid="messages">{state?.messages.map(msg => msg.id).join(', ')}</div>
      <div data-testid="displayMessages">{state?.displayMessages?.map(msg => msg.id).join(', ')}</div>
      <div data-testid="9_lines">{state?.displayMessages?.[9]?.lines?.length || 0}</div>
      <div data-testid="8_lines">{state?.displayMessages?.[8]?.lines?.length || 0}</div>
      <button onClick={() => addMessage(mockMessages[0])}>Add Message</button>
      <button onClick={() => addMessages([mockMessages[1]])}>Add Messages</button>
      <button onClick={() => updateMessages([mockMessages[2]])}>Update Messages</button>
    </div>
  );
};

describe('ChatDataContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (processMessage as jest.Mock).mockImplementation(async (language: string, msg: any) => ({
      ...msg,
      processed_at: new Date().toISOString(),
      lines: [{
        text: msg.content,
        segments: []
      }]
    }));
    (processMessages as jest.Mock).mockImplementation(async (language: string, msgs: any[]) => 
      msgs.map(msg => ({
        ...msg,
        processed_at: new Date().toISOString(),
        lines: msg.content.split('\n').map((line: string) => ({
          text: line,
          segments: []
        }))
      }))
    );
  });

  it('should initialize with mock data', async () => {
    const { getByTestId } = await act(async () => {
      return render(
        <ReadingAidProvider>
          <ChatDataProvider chatId="1" initialData={mockChatData}>
            <TestComponent />
          </ChatDataProvider>
        </ReadingAidProvider>
      );
    });

    expect(getByTestId('messageCount').textContent).toBe('10');
    expect(getByTestId('isProcessing').textContent).toBe('false');
  });

  it('should initialize with empty state', async () => {
    const { getByTestId } = await act(async () => {
        return render(
          <ReadingAidProvider>
            <ChatDataProvider chatId="1" initialData={null}>
                <TestComponent />
            </ChatDataProvider>
          </ReadingAidProvider>
            );
    });

    expect(getByTestId('messageCount').textContent).toBe('');
  });

  it('messages should be in reverse order from the chat data', async () => {
    const { getByTestId } = await act(async () => {
        return render(
          <ReadingAidProvider>
            <ChatDataProvider chatId="1" initialData={mockChatData}>
                <TestComponent />
            </ChatDataProvider>
          </ReadingAidProvider>
            );
    });

    expect(getByTestId('displayMessages').textContent).toBe('9, 8, 7, 6, 5, 4, 3, 2, 1, 0');
  });

  it('messages should be split into lines', async () => {
    const { getByTestId } = await act(async () => {
        return render(
          <ReadingAidProvider>
            <ChatDataProvider chatId="1" initialData={mockChatData}>
                <TestComponent />
            </ChatDataProvider>
          </ReadingAidProvider>
            );
    });

    expect(getByTestId('9_lines').textContent).toBe('1');
    expect(getByTestId('8_lines').textContent).toBe('9');
  });

  it('displayed messages should be in reverse order of input messages', async () => {
    const { getByTestId } = await act(async () => {
      return render(
        <ReadingAidProvider>
          <ChatDataProvider chatId="1" initialData={mockChatData}>
            <TestComponent />
          </ChatDataProvider>
        </ReadingAidProvider>
      );
    });

    // Get the displayed message IDs
    const displayedIds = getByTestId('displayMessages').textContent?.split(', ').map(Number) || [];
    
    // Get the original message IDs in reverse order
    const originalIds = [...mockChatData.messages].reverse().map(msg => msg.id);
    
    // Compare the arrays
    expect(displayedIds).toEqual(originalIds);
  });

  it('should process and add a single message', async () => {
    const { getByText, getByTestId } = render(
      <ReadingAidProvider>
        <ChatDataProvider chatId="1" initialData={mockChatDataNoMessages}>
          <TestComponent />
        </ChatDataProvider>
      </ReadingAidProvider>
    );

    // Wait for initial state to be set up
    await waitFor(() => {
      expect(getByTestId('messageCount').textContent).toBe('0');
    });

    await act(async () => {
      getByText('Add Message').click();
    });

    // Wait for processing to complete and message to be added
    await waitFor(() => {
      expect(getByTestId('isProcessing').textContent).toBe('false');
    });
    
    await waitFor(() => {
      expect(getByTestId('messageCount').textContent).toBe('1');
    });
  });

//   it('should process and add multiple messages', async () => {
//     const { getByText, getByTestId } = render(
//       <ChatDataProvider initialData={null}>
//         <TestComponent />
//       </ChatDataProvider>
//     );

//     await act(async () => {
//       getByText('Add Messages').click();
//     });

//     expect(processMessages).toHaveBeenCalledWith('en', expect.any(Array));
//     expect(getByTestId('messageCount').textContent).toBe('1');
//   });

//   it('should process and update messages', async () => {
//     const { getByText, getByTestId } = render(
//       <ChatDataProvider initialData={null}>
//         <TestComponent />
//       </ChatDataProvider>
//     );

//     await act(async () => {
//       getByText('Update Messages').click();
//     });

//     expect(processMessages).toHaveBeenCalledWith('en', expect.any(Array));
//     expect(getByTestId('messageCount').textContent).toBe('1');
//   });

//   it('should process initial data', async () => {
//     const { getByText, getByTestId } = render(
//       <ChatDataProvider initialData={null}>
//         <TestComponent />
//       </ChatDataProvider>
//     );

//     await act(async () => {
//       getByText('Add Initial Data').click();
//     });

//     expect(processMessages).toHaveBeenCalledWith('en', expect.any(Array));
//     expect(getByTestId('messageCount').textContent).toBe('1');
//   });

//   it('should show processing state while messages are being processed', async () => {
//     (processMessage as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
//     const { getByText, getByTestId } = render(
//       <ChatDataProvider initialData={null}>
//         <TestComponent />
//       </ChatDataProvider>
//     );

//     const addButton = getByText('Add Message');
    
//     // Start processing
//     act(() => {
//       addButton.click();
//     });
    
//     expect(getByTestId('isProcessing').textContent).toBe('true');

//     // Wait for processing to complete
//     await act(async () => {
//       await new Promise(resolve => setTimeout(resolve, 100));
//     });

//     expect(getByTestId('isProcessing').textContent).toBe('false');
//   });
}); 