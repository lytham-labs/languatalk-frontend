import { Audio, AVPlaybackStatus } from 'expo-av';
import { Animated, Platform } from 'react-native';
import { EventEmitter } from 'events';
import WordAnimationService from './WordAnimationService';
import SentenceAnimationService from './SentenceAnimationService';

type HighlightMode = 'word' | 'sentence' | 'off';

class AudioPlayerService {
	private emitter: EventEmitter;
	private sound: Audio.Sound | null = null;
	private animationService: WordAnimationService | SentenceAnimationService | null = null;
	private animationInterval: NodeJS.Timeout | null = null;
	private currentChatMessageId: string | null = null;
	private currentAudioUrl: string | null = null;
	private isSlowAudio: boolean = false;
	public isPlaying: boolean = false;
	private hasPlayedOnce: boolean = false;
	private playedAudioUrls: Set<string> = new Set();
	private isAndroid: boolean = Platform.OS === 'android';
	private highlightMode: HighlightMode = 'word';
	private currentWordTimings: any = null;
	private currentText: string | null = null;

	constructor() {
		this.emitter = new EventEmitter();
		this.configureAudioMode();
	}

	private async configureAudioMode() {
		const audioMode = {
			playsInSilentModeIOS: true,
			shouldDuckAndroid: true,
			staysActiveInBackground: true,
		};

		await Audio.setAudioModeAsync(audioMode);
	}

	// Use this method to add event listeners
	on(eventName: string, listener: (...args: any[]) => void) {
		this.emitter.on(eventName, listener);
	}

	// Use this method to remove event listeners
	off(eventName: string, listener: (...args: any[]) => void) {
		this.emitter.off(eventName, listener);
	}

	// Use this method to emit events
	emit(eventName: string, ...args: any[]) {
		this.emitter.emit(eventName, ...args);
	}

	async playSound(
		audioUrl: string, 
		wordTimings: any, 
		chatMessageId: string, 
		isSlowAudio: boolean, 
		highlightMode: HighlightMode,
		text: string,
		onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void
	) {
		this.currentText = text;
		this.hasPlayedOnce = this.currentAudioUrl === audioUrl;
		if (this.sound && this.currentAudioUrl === audioUrl) {
			const status = await this.sound.getStatusAsync();
			if (status.isLoaded) {
				// Check if audio has finished playing (position equals duration)
				if (status.durationMillis && status.positionMillis &&
					status.durationMillis > 0 &&
					status.positionMillis === status.durationMillis) {
					// Replay from beginning
					await this.sound.setPositionAsync(0);
					await this.resumeSound();
				} else if (status.isPlaying) {
					await this.pauseSound();
				} else {
					await this.resumeSound();
				}
				return this.sound;
			}
		}

		if (this.sound) {
			await this.stopSound();
		}

		const { sound } = await Audio.Sound.createAsync(
			{ uri: audioUrl },
			{ shouldPlay: true },
			this.onPlaybackStatusUpdate(onPlaybackStatusUpdate)
		);

		this.sound = sound;
		this.currentAudioUrl = audioUrl;
		this.isSlowAudio = isSlowAudio;

		// Store current data
		this.currentWordTimings = wordTimings;
		this.currentChatMessageId = chatMessageId;
		this.isSlowAudio = isSlowAudio;

		if (wordTimings !== null && !this.isAndroid && highlightMode !== 'off') {
			this.initializeAnimationService(highlightMode);
			this.animationService?.initializeAnimations(wordTimings, chatMessageId, isSlowAudio, text);
			this.startHighlighting();
		}

		this.isPlaying = true;

		return sound;
	}

	private onPlaybackStatusUpdate = (externalCallback: (status: AVPlaybackStatus) => void) => (status: AVPlaybackStatus) => {
		if (status.isLoaded) {
			this.isPlaying = status.isPlaying;
			if (!status.isPlaying && status.didJustFinish) {
				if (!this.hasPlayedOnce && this.currentAudioUrl && !this.playedAudioUrls.has(this.currentAudioUrl)) {
					this.hasPlayedOnce = true;
					if (this.currentAudioUrl) {
						this.playedAudioUrls.add(this.currentAudioUrl);
					}
					if (this.currentChatMessageId) {
						this.emit('firstPlaybackFinished', this.currentChatMessageId);
					}
				}
				this.stopHighlighting();
			} else if (!this.animationInterval && status.isPlaying) {
				this.startHighlighting();
			}
		}
		externalCallback(status);
	}

	async pauseSound() {
		if (this.sound) {
			await this.sound.pauseAsync();
			this.isPlaying = false;
			this.stopHighlighting();
		}
	}

	async resumeSound() {
		if (this.sound) {
				await this.sound.playAsync();
			this.isPlaying = true;
			this.startHighlighting();
		}
	}

	private startHighlighting() {
		this.stopHighlighting();
		this.animationInterval = setInterval(() => {
			if (this.isPlaying && this.sound) {
				this.sound.getStatusAsync().then(status => {
					if (status.isLoaded && status.isPlaying) {
						this.updateHighlighting(status.positionMillis);
					}
				});
			}
		}, 50); // Update every 50ms
	}

	private updateHighlighting(currentTime: number) {
		if (this.animationService) {
			this.animationService.startHighlighting(currentTime);
		}
	}

	private stopHighlighting() {
		if (this.animationInterval) {
			clearInterval(this.animationInterval);
			this.animationInterval = null;
		}
		if (this.animationService) {
			this.animationService.stopHighlighting();
		}
	}

	getWordAnimation(index: number, chatMessageId: string, highlightMode: HighlightMode, text?: string): Animated.Value {
		this.setHighlightMode(highlightMode, text);

		return this.animationService?.getWordAnimation(index, chatMessageId, text) ?? new Animated.Value(0);
	}

	async stopSound() {
		// Store a reference to the sound object to prevent race conditions
		const soundToStop = this.sound;
		
		if (soundToStop) {
			try {
				// Check if the sound is loaded before attempting to stop/unload
				const status = await soundToStop.getStatusAsync();
				
				if (status.isLoaded) {
					// Only call stopAsync if the sound is actually playing
					if (status.isPlaying) {
						await soundToStop.stopAsync();
					}
					await soundToStop.unloadAsync();
				}
			} catch (error) {
				console.error('Error stopping sound:', error);
				// Continue with cleanup even if there's an error
			} finally {
				this.sound = null;
			}
		}
		
		this.stopHighlighting();
		this.animationService = null;
		this.currentChatMessageId = null;
		this.currentAudioUrl = null;
		this.currentWordTimings = null;
		this.isSlowAudio = false;
		this.isPlaying = false;
	}

	private initializeAnimationService(mode: HighlightMode) {
		// Clean up existing animation service if it exists
		if (this.animationService) {
			this.animationService.stopHighlighting();
		}

		// Create new animation service based on mode
		this.animationService = mode === 'word' 
			? new WordAnimationService()
			: new SentenceAnimationService();

		this.highlightMode = mode;
	}

	setHighlightMode(mode: HighlightMode, text: string) {
		if (this.highlightMode === mode) return;
		
		this.highlightMode = mode;
		
		// Stop current highlighting
		this.stopHighlighting();
		
		// Reinitialize animation service if we have active audio
		if (this.currentWordTimings && !this.isAndroid && mode !== 'off') {
			this.initializeAnimationService(mode);
			this.animationService?.initializeAnimations(
				this.currentWordTimings,
				this.currentChatMessageId!,
				this.isSlowAudio,
				text || this.currentText || ''
			);
			if (this.isPlaying) {
				this.startHighlighting();
			}
		}
	}
}

export default AudioPlayerService;
