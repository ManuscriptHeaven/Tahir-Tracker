import React, { useState, useEffect, useRef } from 'react';
import { NavTab } from '../../types';
import { AIChatMessage, AIProposal } from '../../types/ai';
import { speechService, SpeechRecognitionResultPayload } from '../../services/speechService';
import { parseNaturalLanguageInput } from '../../services/aiParser';
import { executeAIProposal } from '../../services/aiExecutor';
import { 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  X, 
  Volume2, 
  VolumeX, 
  Zap,
  Milk,
  HandCoins,
  Fuel,
  Home,
  CheckCircle2,
  Edit2
} from 'lucide-react';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: 'Assalam-o-Alaikum! Main aapka AI Voice Assistant hoon. Aap bol kar ya likh kar koi bhi entry (Utility Bill, Milk, Loans, Petrol, Rent) karwa sakte hain. Main pehle aapse approval loonga phir save karunga.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<AIProposal | null>(null);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(true);
  const [speechLanguage, setSpeechLanguage] = useState<'ur-PK' | 'en-US'>('ur-PK');
  const [editableFields, setEditableFields] = useState<Record<string, any>>({});
  const [isEditingFields, setIsEditingFields] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingProposal, isListening]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      speechService.stopListening();
      setIsListening(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Speech Recognition toggle
  const toggleListening = () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
    } else {
      speechService.setLanguage(speechLanguage);
      speechService.startListening(
        (result: SpeechRecognitionResultPayload) => {
          setInputValue(result.transcript);
          if (result.isFinal) {
            handleProcessPrompt(result.transcript, true);
          }
        },
        (listening: boolean) => {
          setIsListening(listening);
        },
        (err: string) => {
          console.warn('Speech recognition error:', err);
          setIsListening(false);
        }
      );
    }
  };

  // Process natural language command
  const handleProcessPrompt = async (promptText: string, isVoice = false) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    speechService.stopListening();
    setIsListening(false);
    setInputValue('');
    setIsProcessing(true);

    const userMsg: AIChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const proposal = await parseNaturalLanguageInput(trimmed);

      if (proposal.actionType === 'navigate') {
        const targetTab = proposal.payload.targetTab as NavTab;
        const replyText = `Theek hai, ${proposal.title} khol rahe hain...`;
        
        const assistantMsg: AIChatMessage = {
          id: `msg_bot_${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, assistantMsg]);
        if (voiceFeedbackEnabled) speechService.speak(replyText);

        setTimeout(() => {
          onNavigate(targetTab);
          onClose();
        }, 800);
        setIsProcessing(false);
        return;
      }

      // If approval is required
      setPendingProposal(proposal);
      // Initialize editable fields with payload values
      setEditableFields({ ...proposal.payload });
      setIsEditingFields(false);

      const botPromptUrdu = proposal.urduSummary || 'Kya aap ye entry confirm karte hain?';
      const botMsg: AIChatMessage = {
        id: `msg_bot_${Date.now()}`,
        sender: 'assistant',
        text: botPromptUrdu,
        proposal,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);

      if (voiceFeedbackEnabled) {
        speechService.speak(botPromptUrdu);
      }
    } catch (err: any) {
      console.error('AI Parsing error:', err);
      const errorMsg: AIChatMessage = {
        id: `msg_bot_err_${Date.now()}`,
        sender: 'assistant',
        text: 'Maazrat, main aapki baat samajh nahi saka. Baraye meharbani dobara bol kar ya likh kar try karein.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // User Approves Proposal
  const handleApproveProposal = async () => {
    if (!pendingProposal) return;
    setIsProcessing(true);

    // Merge any modified editable fields into proposal payload
    const finalProposal: AIProposal = {
      ...pendingProposal,
      payload: {
        ...pendingProposal.payload,
        ...editableFields
      }
    };

    const res = await executeAIProposal(finalProposal);

    const confirmationMsg: AIChatMessage = {
      id: `msg_bot_confirm_${Date.now()}`,
      sender: 'assistant',
      text: res.message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, confirmationMsg]);
    setPendingProposal(null);
    setIsEditingFields(false);
    setIsProcessing(false);

    if (voiceFeedbackEnabled) {
      speechService.speak(res.message.replace(/✅/g, ''));
    }
  };

  // User Rejects Proposal
  const handleRejectProposal = () => {
    setPendingProposal(null);
    setIsEditingFields(false);

    const cancelMsg: AIChatMessage = {
      id: `msg_bot_cancel_${Date.now()}`,
      sender: 'assistant',
      text: 'Entry cancel kar di gayi hai. Koi aur entry karni ho to batayein.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, cancelMsg]);
    if (voiceFeedbackEnabled) {
      speechService.speak('Entry cancel kar di gayi hai.');
    }
  };

  // Quick Prompt Chips
  const exampleChips = [
    'Saleem bhai ka august k bill update kr do 2000',
    'Saleem ka 2 kg doodh add kr do',
    'Ali ko 5000 udhar diya',
    'Portion 4 ka rent 10000 mila',
    'Petrol 3000 ka reading 14500',
    'Tayyab ka doodh missed'
  ];

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'utility':
        return { icon: Zap, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: 'Utility Bills' };
      case 'milk':
        return { icon: Milk, color: 'bg-teal-500/20 text-[#18E6BE] border-teal-500/40', label: 'Milk Tracker' };
      case 'loans':
        return { icon: HandCoins, color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', label: 'Loans & Udhaar' };
      case 'petrol':
        return { icon: Fuel, color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'Petrol Fuel' };
      case 'rent':
        return { icon: Home, color: 'bg-teal-500/20 text-teal-300 border-teal-500/40', label: 'Rent Management' };
      default:
        return { icon: Sparkles, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', label: 'Household' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Assistant Sheet / Modal */}
      <div className="relative z-10 w-full max-w-2xl bg-[#0B1D2C] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[90vh] sm:h-[82vh] max-h-[750px] overflow-hidden border border-cyan-500/30">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-[#071724] border-b border-slate-800 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-[#18E6BE] shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse text-[#18E6BE]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base leading-tight text-white">
                  Tahir AI Assistant
                </h2>
                <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full bg-teal-500/20 text-[#18E6BE] border border-teal-500/30">
                  Voice & Approval
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                Speak or type commands in Roman Urdu / English
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language Switcher */}
            <button
              onClick={() => {
                const nextLang = speechLanguage === 'ur-PK' ? 'en-US' : 'ur-PK';
                setSpeechLanguage(nextLang);
                speechService.setLanguage(nextLang);
              }}
              className="px-2 py-1 bg-[#102638] hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="Toggle Speech Recognition Language"
            >
              {speechLanguage === 'ur-PK' ? 'Urdu (PK)' : 'English'}
            </button>

            {/* Voice Feedback Toggle */}
            <button
              onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
              className="p-1.5 bg-[#102638] hover:bg-slate-700 rounded-lg text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title={voiceFeedbackEnabled ? 'Voice Output ON' : 'Voice Output Muted'}
            >
              {voiceFeedbackEnabled ? <Volume2 className="w-4 h-4 text-[#18E6BE]" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 bg-[#102638] hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white border border-slate-700 transition-all ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat / Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#071724]">
          
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-[#18E6BE] border border-teal-500/30 flex-shrink-0 flex items-center justify-center shadow-xs text-xs font-bold mt-1">
                    TT
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-lg ${
                      isUser
                        ? 'bg-gradient-to-r from-teal-500 to-[#18E6BE] text-[#06131F] font-bold rounded-br-none'
                        : 'bg-[#0B1D2C] text-slate-200 border border-cyan-500/20 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1">
                      <span>{isUser ? 'Aap' : 'AI Assistant'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>

                {isUser && msg.isVoice && (
                  <div className="w-6 h-6 rounded-full bg-teal-500/20 text-[#18E6BE] border border-teal-500/30 flex-shrink-0 flex items-center justify-center text-xs mt-1" title="Voice Input">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* APPROVAL CARD (When AI detected an entry that needs user confirmation) */}
          {pendingProposal && (
            <div className="bg-[#0B1D2C] border-2 border-[#18E6BE] rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              
              {/* Card Header with Category Badge */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const badge = getCategoryBadge(pendingProposal.category);
                    const Icon = badge.icon;
                    return (
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border ${badge.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {badge.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs font-bold text-slate-400">
                    Confirmation Required
                  </span>
                </div>

                <button
                  onClick={() => setIsEditingFields(!isEditingFields)}
                  className="px-2 py-1 bg-[#102638] hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  {isEditingFields ? 'Done Editing' : 'Edit Details'}
                </button>
              </div>

              {/* Title & Summary */}
              <div>
                <h3 className="font-black text-white text-sm sm:text-base">
                  {pendingProposal.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {pendingProposal.urduSummary}
                </p>
              </div>

              {/* Fields Table / Grid */}
              <div className="bg-[#071724] rounded-2xl p-3 border border-slate-800 space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Entry Breakdown
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {pendingProposal.fields.map((f) => (
                    <div key={f.key} className="bg-[#0B1D2C] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold">{f.label}</div>
                      {isEditingFields && (f.key === 'amount' || f.key === 'actualKg' || f.key === 'totalCost' || f.key === 'paidAmount' || f.key === 'odometerReading') ? (
                        <input
                          type="number"
                          value={editableFields[f.key] ?? f.value}
                          onChange={(e) => setEditableFields({ ...editableFields, [f.key]: Number(e.target.value) })}
                          className="w-full mt-1 px-2 py-1 bg-[#071724] border border-[#18E6BE] rounded-lg text-xs font-black text-white focus:outline-none"
                        />
                      ) : (
                        <div className="font-black text-white mt-0.5">
                          {editableFields[f.key] !== undefined && (f.key === 'amount' || f.key === 'totalCost' || f.key === 'paidAmount')
                            ? `${Number(editableFields[f.key]).toLocaleString()} PKR`
                            : f.value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Approval Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={handleRejectProposal}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-3 bg-[#102638] hover:bg-slate-700 active:bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Nahi, Cancel</span>
                </button>

                <button
                  onClick={handleApproveProposal}
                  disabled={isProcessing}
                  className="flex-[2] py-2.5 px-4 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] active:scale-98 text-[#06131F] font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(24,230,190,0.3)] transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>{isProcessing ? 'Saving Entry...' : 'Haan, Confirm & Save'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Listening soundwave animation */}
          {isListening && (
            <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-[#18E6BE] opacity-75"></span>
                  <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-[#18E6BE] text-[#06131F] flex items-center justify-center font-bold">
                    <Mic className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-teal-300">
                    Aapki aawaz sun raha hoon...
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Bolein: &quot;Saleem bhai ka august k bill update kr do 2000&quot;
                  </div>
                </div>
              </div>

              {/* Sound wave visualizer bars */}
              <div className="flex items-center gap-1">
                {[4, 12, 8, 16, 10, 14, 6].map((height, i) => (
                  <div
                    key={i}
                    style={{ height: `${height * 1.5}px` }}
                    className="w-1 bg-[#18E6BE] rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Example Quick Prompt Chips */}
        <div className="px-4 py-2 bg-[#0B1D2C] border-t border-slate-800 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Suggestions:
          </span>
          {exampleChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleProcessPrompt(chip, false)}
              className="px-2.5 py-1 bg-[#102638] hover:bg-teal-500/20 hover:text-[#18E6BE] hover:border-teal-500/40 border border-slate-700/80 rounded-xl text-[11px] font-semibold text-slate-300 whitespace-nowrap transition-all shadow-xs cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Bottom Input Controls (Mic + Text Input + Send) */}
        <div className="p-3 sm:p-4 bg-[#071724] border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputValue.trim()) {
                handleProcessPrompt(inputValue, false);
              }
            }}
            className="flex items-center gap-2"
          >
            {/* Big Mic Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-500/30'
                  : 'bg-gradient-to-tr from-teal-500 to-[#18E6BE] text-[#06131F] font-bold shadow-[0_0_15px_rgba(24,230,190,0.25)]'
              }`}
              title={isListening ? 'Stop Listening' : 'Click to Speak (Voice Command)'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isListening ? 'Bolte jayein...' : 'Likhein ya mic daba kar bolein...'}
                className="w-full px-4 py-2.5 bg-[#0B1D2C] border border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all pr-10"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="p-2.5 bg-[#102638] hover:bg-[#18E6BE] hover:text-[#06131F] border border-slate-700 disabled:opacity-40 disabled:hover:bg-[#102638] disabled:hover:text-slate-400 text-slate-200 rounded-2xl transition-colors shadow-xs cursor-pointer"
              title="Send Command"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
