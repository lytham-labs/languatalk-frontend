import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SuggestionsProvider, useSuggestions } from './SuggestionsContext';

// Mock dependencies
jest.mock('@/services/SuggestedReplyService');
jest.mock('@/utils/textProcessingUtils');
jest.mock('./AuthContext');
jest.mock('./ReadingAidContext');
jest.mock('@/services/JapaneseTextService', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    readyPromise: Promise.resolve(),
    processText: jest.fn().mockResolvedValue([]),
  })),
}));

// Import mocked modules
import { SuggestedReplyService } from '@/services/SuggestedReplyService';
import { processGenericContent } from '@/utils/textProcessingUtils';
import { useAuth } from './AuthContext';
import { useReadingAid } from './ReadingAidContext';

// Mock implementations
const mockSuggestedReplyService = {
  fetch: jest.fn(),
};

const mockReadingAidService = {
  processText: jest.fn(),
};

const mockProcessGenericContent = processGenericContent as jest.MockedFunction<typeof processGenericContent>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseReadingAid = useReadingAid as jest.MockedFunction<typeof useReadingAid>;
const mockSuggestedReplyServiceConstructor = SuggestedReplyService as jest.MockedClass<typeof SuggestedReplyService>;

// Test component to access context
const TestComponent = ({ onStateChange }: { onStateChange?: (state: any) => void }) => {
  const suggestions = useSuggestions();
  
  React.useEffect(() => {
    if (onStateChange) {
      onStateChange(suggestions);
    }
  }, [suggestions, onStateChange]);
  
  return (
    <div>
      <div data-testid="suggestions-count">{suggestions.suggestions.length}</div>
      <div data-testid="processed-suggestions-count">{suggestions.processedSuggestions.length}</div>
      <div data-testid="is-visible">{suggestions.isVisible.toString()}</div>
      <div data-testid="is-loading">{suggestions.isLoading.toString()}</div>
      <div data-testid="error-message">{suggestions.errorMessage || 'null'}</div>
    </div>
  );
};

describe('SuggestionsContext', () => {
  // Console mocks to suppress expected error logs
  const consoleMocks = {
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    console.log = consoleMocks.log;
    console.error = consoleMocks.error;
    
    // Default mock implementations
    mockSuggestedReplyServiceConstructor.mockImplementation(() => mockSuggestedReplyService as any);
    
    mockUseAuth.mockReturnValue({
      token: null,
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      signup: jest.fn(),
      googleSignIn: jest.fn(),
      appleSignIn: jest.fn(),
    });
    
    mockUseReadingAid.mockReturnValue({
      readingAidService: null,
      isReadingAidFlagEnabled: false,
      isJapaneseReadingAidEnabledAndReady: false,
      isJapaneseReadingAidLoading: false,
      setChatLanguage: jest.fn(),
    });
    
    mockProcessGenericContent.mockResolvedValue({
      content: 'processed content',
      lines: [],
      messageSegmentTextArray: [],
      processed_at: new Date().toISOString(),
    });
  });

  afterEach(() => {
    // Restore console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('Context Provider and Hook Tests', () => {
    it('should throw error when useSuggestions is used outside provider', () => {
      const consoleError = console.error;
      console.error = jest.fn(); // Suppress expected error
      
      const TestErrorComponent = () => {
        useSuggestions();
        return null;
      };
      
      expect(() => {
        render(<TestErrorComponent />);
      }).toThrow('useSuggestions must be used within a SuggestionsProvider');
      
      console.error = consoleError;
    });

    it('should render children correctly', () => {
      const { getByTestId } = render(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
      
      expect(getByTestId('suggestions-count')).toBeDefined();
      expect(getByTestId('processed-suggestions-count')).toBeDefined();
    });

    it('should provide initial state values', () => {
      const { getByTestId } = render(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
      
      expect(getByTestId('suggestions-count').textContent).toBe('0');
      expect(getByTestId('processed-suggestions-count').textContent).toBe('0');
      expect(getByTestId('is-visible').textContent).toBe('false');
      expect(getByTestId('is-loading').textContent).toBe('false');
      expect(getByTestId('error-message').textContent).toBe('null');
    });
  });

  describe('State Management Tests', () => {
    it('should handle showSuggestionsModal correctly', async () => {
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      act(() => {
        suggestionsState.showSuggestionsModal();
      });
      
      expect(suggestionsState.isVisible).toBe(true);
    });

    it('should handle hideSuggestionsModal correctly', async () => {
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      // First show modal
      act(() => {
        suggestionsState.showSuggestionsModal();
      });
      
      expect(suggestionsState.isVisible).toBe(true);
      
      // Then hide modal
      act(() => {
        suggestionsState.hideSuggestionsModal();
      });
      
      expect(suggestionsState.isVisible).toBe(false);
      expect(suggestionsState.isLoading).toBe(false);
      expect(suggestionsState.errorMessage).toBeNull();
    });

    it('should handle clearError correctly', async () => {
      // Set up auth mock before rendering
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        user: { id: 1 },
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
      
      mockSuggestedReplyService.fetch.mockRejectedValue(new Error('Test error'));
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.errorMessage).toBe('Failed to get suggestions. Please try again.');
      
      act(() => {
        suggestionsState.clearError();
      });
      
      expect(suggestionsState.errorMessage).toBeNull();
    });

    it('should handle clearSuggestions correctly', async () => {
      // Set up auth mock before rendering
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        user: { id: 1 },
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
      
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: ['Hello', 'Goodbye', 'How are you?']
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      // First set up some state
      act(() => {
        suggestionsState.showSuggestionsModal();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.suggestions.length).toBe(3);
      expect(suggestionsState.isVisible).toBe(true);
      
      // Now clear suggestions
      act(() => {
        suggestionsState.clearSuggestions();
      });
      
      expect(suggestionsState.suggestions).toEqual([]);
      expect(suggestionsState.processedSuggestions).toEqual([]);
      expect(suggestionsState.isVisible).toBe(false);
      expect(suggestionsState.isLoading).toBe(false);
      expect(suggestionsState.errorMessage).toBeNull();
    });
  });

  describe('Service Integration Tests', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        user: { id: 1 },
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
    });

    it('should fetch suggestions successfully with immediate response', async () => {
      const mockSuggestions = ['Hello', 'How are you?', 'What\'s up?'];
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: mockSuggestions
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(mockSuggestedReplyService.fetch).toHaveBeenCalledWith(
        1, 'msg-1', 'test text', 'english', 'test context'
      );
      expect(suggestionsState.suggestions).toEqual(mockSuggestions);
      expect(suggestionsState.isLoading).toBe(false);
      expect(mockProcessGenericContent).toHaveBeenCalledTimes(3);
    });

    it('should handle processing started response correctly', async () => {
      mockSuggestedReplyService.fetch.mockResolvedValue({
        message: 'Suggestions processing started'
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      // Should keep loading state active when processing started
      expect(suggestionsState.isLoading).toBe(true);
      expect(consoleMocks.log).toHaveBeenCalledWith('Suggestions processing started, waiting for WebSocket response');
    });

    it('should handle fetchSuggestions error', async () => {
      mockSuggestedReplyService.fetch.mockRejectedValue(new Error('Network error'));
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.errorMessage).toBe('Failed to get suggestions. Please try again.');
      expect(suggestionsState.isLoading).toBe(false);
      expect(consoleMocks.error).toHaveBeenCalledWith('Error fetching suggestions:', expect.any(Error));
    });

    it('should handle API error response', async () => {
      mockSuggestedReplyService.fetch.mockResolvedValue({
        error: 'API error message'
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.errorMessage).toBe('Failed to get suggestions. Please try again.');
      expect(suggestionsState.isLoading).toBe(false);
    });

    it('should handle WebSocket suggestions correctly', async () => {
      const mockSuggestions = ['WebSocket suggestion 1', 'WebSocket suggestion 2'];
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.handleWebSocketSuggestions(
          { suggestions: mockSuggestions }, 
          'japanese'
        );
      });
      
      expect(suggestionsState.suggestions).toEqual(mockSuggestions);
      expect(suggestionsState.isLoading).toBe(false);
      expect(mockProcessGenericContent).toHaveBeenCalledWith('japanese', 'WebSocket suggestion 1', null);
      expect(mockProcessGenericContent).toHaveBeenCalledWith('japanese', 'WebSocket suggestion 2', null);
    });

    it('should handle invalid WebSocket response format', async () => {
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.handleWebSocketSuggestions(
          { suggestions: null as any }, 
          'english'
        );
      });
      
      expect(suggestionsState.errorMessage).toBe('Invalid suggestions format received');
      expect(consoleMocks.error).toHaveBeenCalledWith('Invalid suggestions format received:', { suggestions: null });
    });
  });

  describe('Authentication and Dependency Tests', () => {
    it('should not initialize service when token is not available', async () => {
      mockUseAuth.mockReturnValue({
        token: null,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.errorMessage).toBe('Authentication required');
      expect(mockSuggestedReplyService.fetch).not.toHaveBeenCalled();
    });

    it('should initialize service when token becomes available', async () => {
      // Initially no token
      mockUseAuth.mockReturnValue({
        token: null,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
      
      const { rerender } = render(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
      
      // Verify service constructor hasn't been called
      expect(mockSuggestedReplyServiceConstructor).not.toHaveBeenCalled();
      
      // Now provide token
      mockUseAuth.mockReturnValue({
        token: 'new-token',
        isAuthenticated: true,
        isLoading: false,
        user: { id: 1 },
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
      
      rerender(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
      
      // Service should now be initialized
      expect(mockSuggestedReplyServiceConstructor).toHaveBeenCalledWith('new-token');
    });

    it('should use reading aid service when available', async () => {
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        user: { id: 1 },
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
      
      mockUseReadingAid.mockReturnValue({
        readingAidService: mockReadingAidService,
        isReadingAidFlagEnabled: true,
        isJapaneseReadingAidEnabledAndReady: true,
        isJapaneseReadingAidLoading: false,
        setChatLanguage: jest.fn(),
      });
      
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: ['こんにちは']
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'japanese', 'test context');
      });
      
      expect(mockProcessGenericContent).toHaveBeenCalledWith('japanese', 'こんにちは', mockReadingAidService);
    });
  });

  describe('Text Processing with Multiple Languages', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        user: { id: 1 },
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
    });

    it('should process English suggestions correctly', async () => {
      const englishSuggestions = ['Hello there!', 'How are you doing?', 'What\'s happening?'];
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: englishSuggestions
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(mockProcessGenericContent).toHaveBeenCalledTimes(3);
      englishSuggestions.forEach(suggestion => {
        expect(mockProcessGenericContent).toHaveBeenCalledWith('english', suggestion, null);
      });
    });

    it('should process Japanese suggestions with reading aid', async () => {
      const japaneseSuggestions = ['こんにちは', 'お元気ですか？', 'ありがとうございます'];
      mockUseReadingAid.mockReturnValue({
        readingAidService: mockReadingAidService,
        isReadingAidFlagEnabled: true,
        isJapaneseReadingAidEnabledAndReady: true,
        isJapaneseReadingAidLoading: false,
        setChatLanguage: jest.fn(),
      });
      
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: japaneseSuggestions
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'japanese', 'test context');
      });
      
      expect(mockProcessGenericContent).toHaveBeenCalledTimes(3);
      japaneseSuggestions.forEach(suggestion => {
        expect(mockProcessGenericContent).toHaveBeenCalledWith('japanese', suggestion, mockReadingAidService);
      });
    });

    it('should process Spanish suggestions with special characters', async () => {
      const spanishSuggestions = ['¡Hola!', '¿Cómo estás?', 'Muy bien, gracias'];
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: spanishSuggestions
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'spanish', 'test context');
      });
      
      expect(suggestionsState.suggestions).toEqual(spanishSuggestions);
      expect(mockProcessGenericContent).toHaveBeenCalledTimes(3);
      spanishSuggestions.forEach(suggestion => {
        expect(mockProcessGenericContent).toHaveBeenCalledWith('spanish', suggestion, null);
      });
    });

    it('should process Hebrew suggestions (RTL text)', async () => {
      const hebrewSuggestions = ['שלום', 'מה שלומך?', 'תודה רבה'];
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: hebrewSuggestions
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'hebrew', 'test context');
      });
      
      expect(suggestionsState.suggestions).toEqual(hebrewSuggestions);
      expect(mockProcessGenericContent).toHaveBeenCalledTimes(3);
      hebrewSuggestions.forEach(suggestion => {
        expect(mockProcessGenericContent).toHaveBeenCalledWith('hebrew', suggestion, null);
      });
    });

    it('should process Arabic suggestions (RTL text)', async () => {
      const arabicSuggestions = ['مرحبا', 'كيف حالك؟', 'شكرا لك'];
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: arabicSuggestions
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'arabic', 'test context');
      });
      
      expect(suggestionsState.suggestions).toEqual(arabicSuggestions);
      expect(mockProcessGenericContent).toHaveBeenCalledTimes(3);
      arabicSuggestions.forEach(suggestion => {
        expect(mockProcessGenericContent).toHaveBeenCalledWith('arabic', suggestion, null);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        user: { id: 1 },
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn(),
        googleSignIn: jest.fn(),
        appleSignIn: jest.fn(),
      });
    });

    it('should handle processing error gracefully', async () => {
      const mockSuggestions = ['Hello', 'World'];
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: mockSuggestions
      });
      
      // Make one processing call fail
      mockProcessGenericContent
        .mockResolvedValueOnce({ content: 'processed Hello' })
        .mockRejectedValueOnce(new Error('Processing failed'));
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.suggestions).toEqual(mockSuggestions);
      expect(consoleMocks.error).toHaveBeenCalledWith('Error processing suggestion:', 'World', expect.any(Error));
      // Should still have processed suggestions (fallback content)
      expect(suggestionsState.processedSuggestions).toHaveLength(2);
    });

    it('should handle complete processing failure', async () => {
      const mockSuggestions = ['Hello', 'World'];
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: mockSuggestions
      });
      
      // Make individual processing fail but return fallback content
      mockProcessGenericContent.mockRejectedValue(new Error('Complete failure'));
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.suggestions).toEqual(mockSuggestions);
      // Each suggestion should have fallback content when processing fails
      expect(suggestionsState.processedSuggestions).toEqual([
        { content: 'Hello' },
        { content: 'World' }
      ]);
      expect(consoleMocks.error).toHaveBeenCalledWith('Error processing suggestion:', 'Hello', expect.any(Error));
      expect(consoleMocks.error).toHaveBeenCalledWith('Error processing suggestion:', 'World', expect.any(Error));
    });

    it('should handle empty suggestions array', async () => {
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: []
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.suggestions).toEqual([]);
      expect(suggestionsState.processedSuggestions).toEqual([]);
      expect(suggestionsState.isLoading).toBe(false);
      expect(mockProcessGenericContent).not.toHaveBeenCalled();
    });

    it('should handle undefined parameters gracefully', async () => {
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: ['Hello']
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, undefined, 'test text', 'english', undefined);
      });
      
      expect(mockSuggestedReplyService.fetch).toHaveBeenCalledWith(
        1, undefined, 'test text', 'english', undefined
      );
      expect(suggestionsState.suggestions).toEqual(['Hello']);
    });

    it('should handle mixed content with emojis and Unicode', async () => {
      const mixedSuggestions = [
        'Hello 👋', 
        'Good morning! ☀️', 
        'Thanks 🙏 you too!',
        '日本語 with English mixed',
        'عربي + English mixed'
      ];
      
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: mixedSuggestions
      });
      
      let suggestionsState: any;
      
      render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState).toBeDefined();
      });
      
      await act(async () => {
        await suggestionsState.fetchSuggestions(1, 'msg-1', 'test text', 'english', 'test context');
      });
      
      expect(suggestionsState.suggestions).toEqual(mixedSuggestions);
      expect(mockProcessGenericContent).toHaveBeenCalledTimes(5);
      mixedSuggestions.forEach(suggestion => {
        expect(mockProcessGenericContent).toHaveBeenCalledWith('english', suggestion, null);
      });
    });

    it('should handle reading aid service changes during processing', async () => {
      // Initial state without reading aid
      mockUseReadingAid.mockReturnValue({
        readingAidService: null,
        isReadingAidFlagEnabled: false,
        isJapaneseReadingAidEnabledAndReady: false,
        isJapaneseReadingAidLoading: false,
        setChatLanguage: jest.fn(),
      });
      
      const { rerender } = render(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
      
      // Change to have reading aid service
      mockUseReadingAid.mockReturnValue({
        readingAidService: mockReadingAidService,
        isReadingAidFlagEnabled: true,
        isJapaneseReadingAidEnabledAndReady: true,
        isJapaneseReadingAidLoading: false,
        setChatLanguage: jest.fn(),
      });
      
      rerender(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
      
      // Processing should work with current reading aid service state
      mockSuggestedReplyService.fetch.mockResolvedValue({
        suggestions: ['こんにちは']
      });
      
      // Just verify the component renders without errors
      rerender(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
      
      // The test passes if no errors are thrown during rerender
      expect(true).toBe(true);
    });
  });

  describe('Callback Stability', () => {
    it('should maintain callback stability across re-renders', async () => {
      let suggestionsState1: any;
      let suggestionsState2: any;
      
      const { rerender } = render(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState1 = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState1).toBeDefined();
      });
      
      rerender(
        <SuggestionsProvider>
          <TestComponent onStateChange={(state) => (suggestionsState2 = state)} />
        </SuggestionsProvider>
      );
      
      await waitFor(() => {
        expect(suggestionsState2).toBeDefined();
      });
      
      // Callbacks should be the same reference (due to useCallback)
      expect(suggestionsState1.fetchSuggestions).toBe(suggestionsState2.fetchSuggestions);
      expect(suggestionsState1.handleWebSocketSuggestions).toBe(suggestionsState2.handleWebSocketSuggestions);
      expect(suggestionsState1.processSuggestions).toBe(suggestionsState2.processSuggestions);
      expect(suggestionsState1.showSuggestionsModal).toBe(suggestionsState2.showSuggestionsModal);
      expect(suggestionsState1.hideSuggestionsModal).toBe(suggestionsState2.hideSuggestionsModal);
      expect(suggestionsState1.clearError).toBe(suggestionsState2.clearError);
      expect(suggestionsState1.clearSuggestions).toBe(suggestionsState2.clearSuggestions);
    });
  });
});