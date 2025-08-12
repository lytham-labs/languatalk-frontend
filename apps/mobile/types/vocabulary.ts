export interface Word {
    id: string;
    word: string;
    translation: string;
    isSaved: boolean;
}

export interface AudioState {
    isLoading: boolean;
    isPlaying: boolean;
    fileUri?: string | null;
} 
