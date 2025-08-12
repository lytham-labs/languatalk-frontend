import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react';
import { AlternativeResponseProvider, useAlternativeResponse } from '../AlternativeResponseContext';
import { AlternativeResponseService } from '@/services/AlternativeResponseService';
import { processGenericContent } from '@/utils/textProcessingUtils';
import { Message, ProcessedMessage } from '@/types/chat';

// Mock dependencies
jest.mock('@/services/AlternativeResponseService');
jest.mock('@/utils/textProcessingUtils');
jest.mock('../AuthContext', () => ({
  useAuth: jest.fn(() => ({
    token: 'mock-token',
    isAuthenticated: true,
  })),
}));
jest.mock('../ReadingAidContext', () => ({
  useReadingAid: jest.fn(() => ({
    readingAidService: {
      processText: jest.fn().mockResolvedValue([]),
    },
    isJapaneseReadingAidEnabledAndReady: true,
  })),
}));

const mockAlternativeResponseService = AlternativeResponseService as jest.MockedClass<typeof AlternativeResponseService>;
const mockProcessGenericContent = processGenericContent as jest.MockedFunction<typeof processGenericContent>;

// Test component to access context
const TestComponent = () => {
  const context = useAlternativeResponse();
  return (
    <div>
      <div data-testid="alternativeResponse">
        {typeof context.alternativeResponse === 'string' 
          ? context.alternativeResponse 
          : JSON.stringify(context.alternativeResponse)
        }
      </div>
      <div data-testid="isLoading">{context.isLoading.toString()}</div>
      <div data-testid="isVisible">{context.isVisible.toString()}</div>
      <div data-testid="errorMessage">{context.errorMessage || ''}</div>
      <button 
        data-testid="fetchButton"
        onClick={() => context.fetchAndShowAlternativeResponse(
          mockMessage,
          mockChat,
          mockEnsureWebSocketConnection
        )}
      >
        Fetch
      </button>
      <button 
        data-testid="setAndProcessButton"
        onClick={() => context.setAndProcessAlternativeResponse('test text', 'english')}
      >
        Set and Process
      </button>
      <button 
        data-testid="websocketButton"
        onClick={() => context.handleWebSocketAlternativeResponse({
          chat_message_id: '123',
          text: 'websocket response'
        })}
      >
        WebSocket Response
      </button>
      <button data-testid="showModal" onClick={context.showAlternativeModal}>
        Show Modal
      </button>
      <button data-testid="hideModal" onClick={context.hideAlternativeModal}>
        Hide Modal
      </button>
      <button data-testid="clearError" onClick={context.clearError}>
        Clear Error
      </button>
    </div>
  );
};

// Mock data
const mockMessage: Message = {
  id: 123,
  chat_message_id: '123',
  role: 'user',
  content: 'Hello world',
  target_language: 'english',
  target_language_text: 'Hello world',
  english_text: 'Hello world',
  correction: '',
  correction_explanation: '',
  translation: '',
  audio_url: '',
  slow_audio_url: '',
  word_timings: null,
  alternative_response: '',
  highlight_mode: 'word',
  created_at: new Date().toISOString(),
  avatar_url: '',
  hide_text: false,
  audio_only: false,
};

const mockChat = {
  id: 'chat-123',
  language: 'english',
  client_provider: 'openai',
  model: 'gpt-4',
};

const mockEnsureWebSocketConnection = jest.fn().mockResolvedValue(true);

const mockProcessedMessage: Partial<ProcessedMessage> = {
  lines: [
    {
      text: 'Processed text',
      pressableSegments: []
    }
  ]
};

describe('AlternativeResponseContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlternativeResponseService.mockClear();
    mockProcessGenericContent.mockClear();
    
    // Mock the service instance
    const mockServiceInstance = {
      fetch: jest.fn(),
    };
    mockAlternativeResponseService.mockImplementation(() => mockServiceInstance as any);
  });

  it('should provide default context values', () => {
    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    expect(getByTestId('alternativeResponse').textContent).toBe('');
    expect(getByTestId('isLoading').textContent).toBe('false');
    expect(getByTestId('isVisible').textContent).toBe('false');
    expect(getByTestId('errorMessage').textContent).toBe('');
  });

  it('should fetch and show alternative response successfully', async () => {
    const mockServiceInstance = {
      fetch: jest.fn().mockResolvedValue({
        message: 'Alternative response processing started'
      }),
    };
    mockAlternativeResponseService.mockImplementation(() => mockServiceInstance as any);

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      getByTestId('fetchButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('true');
      expect(getByTestId('isVisible').textContent).toBe('true');
    });

    expect(mockServiceInstance.fetch).toHaveBeenCalledWith(
      'chat-123',
      '123',
      'Hello world',
      'english',
      null,
      'openai',
      'gpt-4'
    );
  });

  it('should handle existing alternative response', async () => {
    const mockMessageWithResponse: Message = {
      ...mockMessage,
      alternative_response: 'This is an existing response.',
    };

    const mockProcessedResponse: Partial<ProcessedMessage> = {
      lines: [{ text: 'This is an existing response.', pressableSegments: [] }],
    };

    mockProcessGenericContent.mockResolvedValue(mockProcessedResponse);

    const TestComponentWithExisting = () => {
      const context = useAlternativeResponse();
      return (
        <div>
          <div data-testid="alternativeResponse">
            {typeof context.alternativeResponse === 'string'
              ? context.alternativeResponse
              : JSON.stringify(context.alternativeResponse)}
          </div>
          <div data-testid="isLoading">{context.isLoading.toString()}</div>
          <div data-testid="isVisible">{context.isVisible.toString()}</div>
          <button
            data-testid="fetchButton"
            onClick={() => context.fetchAndShowAlternativeResponse(
              mockMessageWithResponse,
              mockChat,
              mockEnsureWebSocketConnection
            )}
          >
            Fetch
          </button>
        </div>
      );
    };

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponentWithExisting />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      fireEvent.click(getByTestId('fetchButton'));
    });

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
      expect(getByTestId('isVisible').textContent).toBe('true');
      expect(getByTestId('alternativeResponse').textContent).toContain(
        'This is an existing response.'
      );
    });
  });

  it('should handle WebSocket alternative response', async () => {
    mockProcessGenericContent.mockResolvedValue(mockProcessedMessage);

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    // First set loading state
    await act(async () => {
      getByTestId('fetchButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('true');
    });

    // Then handle WebSocket response
    await act(async () => {
      getByTestId('websocketButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
      expect(getByTestId('alternativeResponse').textContent).toContain('Processed text');
    });

    expect(mockProcessGenericContent).toHaveBeenCalledWith(
      'english',
      'websocket response',
      expect.any(Object)
    );
  });

  it('should set and process alternative response', async () => {
    mockProcessGenericContent.mockResolvedValue(mockProcessedMessage);

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      getByTestId('setAndProcessButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('alternativeResponse').textContent).toContain('Processed text');
    });

    expect(mockProcessGenericContent).toHaveBeenCalledWith(
      'english',
      'test text',
      expect.any(Object)
    );
  });

  it('should handle processing errors gracefully', async () => {
    mockProcessGenericContent.mockRejectedValue(new Error('Processing failed'));

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      getByTestId('setAndProcessButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('alternativeResponse').textContent).toBe('test text');
    });
  });

  it('should show and hide modal', () => {
    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    expect(getByTestId('isVisible').textContent).toBe('false');

    act(() => {
      getByTestId('showModal').click();
    });

    expect(getByTestId('isVisible').textContent).toBe('true');

    act(() => {
      getByTestId('hideModal').click();
    });

    expect(getByTestId('isVisible').textContent).toBe('false');
    expect(getByTestId('alternativeResponse').textContent).toBe('');
    expect(getByTestId('isLoading').textContent).toBe('false');
    expect(getByTestId('errorMessage').textContent).toBe('');
  });

  it('should clear error message', () => {
    const TestComponentWithError = () => {
      const context = useAlternativeResponse();
      return (
        <div>
          <div data-testid="errorMessage">{context.errorMessage || ''}</div>
          <button data-testid="clearError" onClick={context.clearError}>
            Clear Error
          </button>
        </div>
      );
    };

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponentWithError />
      </AlternativeResponseProvider>
    );

    // The error message should be empty by default
    expect(getByTestId('errorMessage').textContent).toBe('');

    // Test that clearError doesn't cause any errors
    act(() => {
      getByTestId('clearError').click();
    });

    expect(getByTestId('errorMessage').textContent).toBe('');
  });

  it('should handle fetch errors', async () => {
    const mockServiceInstance = {
      fetch: jest.fn().mockRejectedValue(new Error('Network error')),
    };
    mockAlternativeResponseService.mockImplementation(() => mockServiceInstance as any);

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      getByTestId('fetchButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('errorMessage').textContent).toBe('Failed to get alternative response. Please try again.');
      expect(getByTestId('isVisible').textContent).toBe('false');
    });
  });

  it('should handle unexpected API response', async () => {
    const mockServiceInstance = {
      fetch: jest.fn().mockResolvedValue({
        message: 'Unexpected response'
      }),
    };
    mockAlternativeResponseService.mockImplementation(() => mockServiceInstance as any);

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponent />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      getByTestId('fetchButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('errorMessage').textContent).toBe('Unexpected response from server');
      expect(getByTestId('isVisible').textContent).toBe('false');
    });
  });

  it('should handle WebSocket connection failure', async () => {
    const mockEnsureWebSocketConnectionFailed = jest.fn().mockResolvedValue(false);

    const TestComponentWithFailedConnection = () => {
      const context = useAlternativeResponse();
      return (
        <div>
          <button 
            data-testid="fetchFailedButton"
            onClick={() => context.fetchAndShowAlternativeResponse(
              mockMessage,
              mockChat,
              mockEnsureWebSocketConnectionFailed
            )}
          >
            Fetch Failed
          </button>
          <div data-testid="errorMessage">{context.errorMessage || ''}</div>
        </div>
      );
    };

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponentWithFailedConnection />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      getByTestId('fetchFailedButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('errorMessage').textContent).toBe('Please wait for connection to be established...');
    });
  });

  it('should handle missing chat data', async () => {
    const TestComponentWithNoChat = () => {
      const context = useAlternativeResponse();
      return (
        <div>
          <button 
            data-testid="fetchNoChatButton"
            onClick={() => context.fetchAndShowAlternativeResponse(
              mockMessage,
              null,
              mockEnsureWebSocketConnection
            )}
          >
            Fetch No Chat
          </button>
          <div data-testid="errorMessage">{context.errorMessage || ''}</div>
        </div>
      );
    };

    const { getByTestId } = render(
      <AlternativeResponseProvider>
        <TestComponentWithNoChat />
      </AlternativeResponseProvider>
    );

    await act(async () => {
      getByTestId('fetchNoChatButton').click();
    });

    await waitFor(() => {
      expect(getByTestId('errorMessage').textContent).toBe('Chat not available');
    });
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAlternativeResponse must be used within an AlternativeResponseProvider');
    
    consoleSpy.mockRestore();
  });
}); 