'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, ArrowRight, CheckCircle2, Bot, Loader2, MessageSquare, Check, User } from 'lucide-react';

interface AIInterviewAgentProps {
  candidateName: string;
  appliedSubject: string;
  appliedSegment: string;
  onComplete: (transcript: string) => void;
}

interface ChatMessage {
  id: string;
  speaker: 'AI' | 'Candidate';
  text: string;
  timestamp: string;
  round?: number;
}

const TOTAL_ROUNDS = 4;

const ROUND_TITLES: Record<number, string> = {
  1: 'Pedagogical Engagement & Hook Strategy',
  2: 'Addressing Subject Misconceptions',
  3: 'Scaffolding & Differentiated Instruction',
  4: 'Formative Assessment & Real-World Application'
};

export default function AIInterviewAgent({
  candidateName,
  appliedSubject,
  appliedSegment,
  onComplete
}: AIInterviewAgentProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentCandidateAnswer, setCurrentCandidateAnswer] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submittingFinal, setSubmittingFinal] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize first question on load
  useEffect(() => {
    const initialQuestion = `Hello ${candidateName || 'Candidate'}! I am your AI Academic Evaluator for ${appliedSubject} (${appliedSegment}). Let's start our live text interview:\n\nWhen introducing a challenging new topic in ${appliedSubject}, what specific inquiry-based hook or real-life demonstration do you use to immediately engage ${appliedSegment} students?`;

    setMessages([
      {
        id: `msg_init_${Date.now()}`,
        speaker: 'AI',
        text: initialQuestion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        round: 1
      }
    ]);
  }, [candidateName, appliedSubject, appliedSegment]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const answer = currentCandidateAnswer.trim();
    if (!answer || isGenerating || isCompleted) return;

    const userMessage: ChatMessage = {
      id: `msg_cand_${Date.now()}`,
      speaker: 'Candidate',
      text: answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      round: currentRound
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setCurrentCandidateAnswer('');

    // Check if this was the final round (Round 4)
    if (currentRound >= TOTAL_ROUNDS) {
      setIsCompleted(true);

      const closingMessage: ChatMessage = {
        id: `msg_ai_close_${Date.now()}`,
        speaker: 'AI',
        text: `Thank you, ${candidateName}! You have successfully completed all ${TOTAL_ROUNDS} rounds of this AI subject pedagogy interview. Your responses have been recorded and formatted for the Academic Review Panel. Please click below to submit and advance to the next step.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([...updatedMessages, closingMessage]);
      return;
    }

    // Otherwise fetch the next structured round question from API
    setIsGenerating(true);
    const nextRoundNumber = currentRound + 1;

    try {
      const res = await fetch('/api/ai-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          appliedSubject,
          appliedSegment,
          roundIndex: nextRoundNumber,
          history: updatedMessages.map(m => ({ speaker: m.speaker, text: m.text }))
        })
      });

      const data = await res.json();
      const nextQText = data.nextQuestion || `Could you explain how you handle diverse learning paces among your ${appliedSegment} students in ${appliedSubject}?`;

      const aiResponse: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        speaker: 'AI',
        text: nextQText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        round: nextRoundNumber
      };

      setMessages([...updatedMessages, aiResponse]);
      setCurrentRound(nextRoundNumber);
    } catch (err) {
      console.error('Error fetching next interview question:', err);
      // Resilient fallback
      const fallbackMsg: ChatMessage = {
        id: `msg_ai_fb_${Date.now()}`,
        speaker: 'AI',
        text: `Thank you for sharing your thoughts. In a mixed-ability ${appliedSegment} classroom, what specific strategies do you use to support struggling learners while keeping advanced students challenged in ${appliedSubject}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        round: nextRoundNumber
      };
      setMessages([...updatedMessages, fallbackMsg]);
      setCurrentRound(nextRoundNumber);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalSubmit = () => {
    setSubmittingFinal(true);
    const fullTranscript = messages
      .map(m => `[${m.timestamp}] ${m.speaker === 'AI' ? 'AI Evaluator' : candidateName}: ${m.text}`)
      .join('\n\n');

    onComplete(fullTranscript);
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 text-xs">
      
      {/* Header Bar with Round Progress */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xl shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-base">
                Live AI Subject Interview (Text Chat)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                PROCTORED
              </span>
            </div>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              {appliedSubject} • {appliedSegment} • Evaluates Pedagogy, Misconception Handling & Scaffolding
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Interview Progress</span>
          <span className="text-xs font-bold text-indigo-600 font-mono">
            {isCompleted ? 'Completed (4/4 Rounds)' : `Round ${currentRound} of ${TOTAL_ROUNDS}`}
          </span>
          <span className="text-[10px] text-slate-400 block">
            {ROUND_TITLES[currentRound] || 'Evaluation Complete'}
          </span>
        </div>
      </div>

      {/* Structured Rounds Progress Indicator */}
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((r) => (
          <div
            key={r}
            className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
              r < currentRound || isCompleted
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : r === currentRound
                ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                : 'bg-white/5 border-white/5 text-slate-400 opacity-60'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              {r < currentRound || isCompleted ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <span>{r}.</span>
              )}
              <span className="truncate">R{r}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Live Chat Messages Thread */}
      <div
        ref={chatContainerRef}
        className="p-4 sm:p-6 rounded-2xl bg-slate-50 border border-white/10 max-h-96 min-h-[300px] overflow-y-auto space-y-4 text-xs"
      >
        {messages.map((item) => {
          const isAI = item.speaker === 'AI';
          return (
            <div
              key={item.id}
              className={`flex items-start gap-2.5 ${isAI ? 'justify-start' : 'justify-end'}`}
            >
              {isAI && (
                <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-4 rounded-2xl max-w-[85%] sm:max-w-[75%] leading-relaxed ${
                  isAI
                    ? 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                    : 'brand-primary-btn text-white shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] uppercase font-bold mb-1 opacity-75">
                  <span>{isAI ? 'AI Evaluator' : candidateName || 'You'}</span>
                  <span>{item.timestamp}</span>
                </div>
                <div className="whitespace-pre-line text-xs font-normal">
                  {item.text}
                </div>
              </div>

              {!isAI && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* AI Typing / Analyzing Indicator */}
        {isGenerating && (
          <div className="flex items-start gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-1">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 bg-slate-50 text-slate-700 rounded-2xl border border-slate-200 flex items-center gap-2 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>AI Evaluator is reviewing your response and formulating the next question...</span>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Live Text Input Area */}
      {!isCompleted ? (
        <form onSubmit={handleSendMessage} className="space-y-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Type your answer for Round {currentRound} of {TOTAL_ROUNDS}:
            </label>
            <textarea
              rows={3}
              required
              disabled={isGenerating}
              placeholder="Type your pedagogical explanation clearly and thoroughly (Press Send when finished)..."
              value={currentCandidateAnswer}
              onChange={e => setCurrentCandidateAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="w-full p-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 text-xs focus:outline-none leading-relaxed disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              Tip: Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono text-slate-300">Enter</kbd> to submit answer
            </span>

            <button
              type="submit"
              disabled={!currentCandidateAnswer.trim() || isGenerating}
              className="brand-primary-btn px-6 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Send Answer & Proceed</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Final Completion & Submission Card */
        <div className="p-5 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="font-bold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              All 4 AI Interview Rounds Answered Successfully!
            </span>
            <span className="text-xs font-mono font-bold bg-emerald-500/20 px-2.5 py-1 rounded">
              READY TO SUBMIT
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Your live interview conversation has been compiled into an academic evaluation transcript. Click the button below to submit this stage and immediately proceed to Step 5 (35-Minute Lesson Plan).
          </p>

          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={submittingFinal}
            className="w-full py-3.5 brand-primary-btn rounded-xl font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {submittingFinal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Stage & Advancing...</span>
              </>
            ) : (
              <>
                <span>Complete AI Interview & Proceed to Step 5 (Lesson Plan)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
