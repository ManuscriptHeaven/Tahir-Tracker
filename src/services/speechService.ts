// Web Speech API service for Speech Recognition & Text-To-Speech (TTS)

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
}

export class SpeechService {
  private recognition: any = null;
  private isListening = false;
  private onResultCallback?: (result: SpeechRecognitionResultPayload) => void;
  private onErrorCallback?: (error: string) => void;
  private onStateChangeCallback?: (isListening: boolean) => void;
  private language: string = 'ur-PK'; // Default Urdu (Pakistan) which easily handles Roman Urdu & mixed phrases

  constructor() {
    this.initRecognition();
  }

  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  private initRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Web Speech API is not supported in this browser environment.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStateChangeCallback?.(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text && this.onResultCallback) {
          this.onResultCallback({
            transcript: text.trim(),
            isFinal: !!finalTranscript
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          this.onErrorCallback?.(event.error);
        }
        this.isListening = false;
        this.onStateChangeCallback?.(false);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onStateChangeCallback?.(false);
      };
    } catch (e) {
      console.error('Failed to initialize Speech Recognition:', e);
    }
  }

  public setLanguage(lang: 'ur-PK' | 'en-US' | 'hi-IN') {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public getLanguage() {
    return this.language;
  }

  public startListening(
    onResult: (result: SpeechRecognitionResultPayload) => void,
    onStateChange?: (isListening: boolean) => void,
    onError?: (error: string) => void
  ) {
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) {
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    this.onResultCallback = onResult;
    this.onStateChangeCallback = onStateChange;
    this.onErrorCallback = onError;

    try {
      this.recognition.lang = this.language;
      this.recognition.start();
    } catch (err) {
      console.warn('Recognition start caught error (already started or permission denied):', err);
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Recognition stop error:', err);
      }
    }
    this.isListening = false;
    this.onStateChangeCallback?.(false);
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  // Text-To-Speech (TTS) Voice Synthesis
  public speak(text: string, lang = 'ur-PK') {
    if (!('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Find best available Urdu / Hindi / English voice
      const voices = window.speechSynthesis.getVoices();
      const urVoice = voices.find(v => v.lang.startsWith('ur') || v.lang.startsWith('hi') || v.lang.startsWith('en'));
      if (urVoice) {
        utterance.voice = urVoice;
      }
      utterance.lang = lang;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed:', e);
    }
  }

  public stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechService = new SpeechService();
