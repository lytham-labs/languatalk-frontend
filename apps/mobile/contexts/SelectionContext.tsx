import React, { createContext, useContext, useState, useEffect } from 'react';

interface SelectionContextType {
  selectedVocabWord: string | null;
  selectedSentence: string | null;
  isPhrase: boolean;
  activePhraseSelectionMessageId: string | null;
  setSelectedVocabWord: (word: string | null) => void;
  setSelectedSentence: (sentence: string | null) => void;
  setIsPhrase: (isPhrase: boolean) => void;
  setActivePhraseSelectionMessageId: (id: string | null) => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
    // TODO add reducer for this state
  const [selectedVocabWord, setSelectedVocabWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [isPhrase, setIsPhrase] = useState(false);
  const [activePhraseSelectionMessageId, setActivePhraseSelectionMessageId] = useState<string | null>(null);

  return (
    <SelectionContext.Provider
      value={{
        selectedVocabWord,
        selectedSentence,
        isPhrase,
        activePhraseSelectionMessageId,
        setSelectedVocabWord,
        setSelectedSentence,
        setIsPhrase,
        setActivePhraseSelectionMessageId,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
} 