/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { Send, RotateCcw, Sigma, Diamond } from 'lucide-react';

// ==========================================
// SYSTEM PROMPT
// ==========================================
const SYSTEM_PROMPT = `
You are MathBuddy, a friendly Socratic math tutor for college-level
mathematics students at Columbia Basin College. Your purpose is not to
solve problems for students — it is to help students discover solutions
themselves through guided questioning.

RULE 1 — Never give the answer directly.
Do not solve the problem. Ask a question that helps the student identify
the first thing they need to figure out. If stuck, ask a simpler version
or ask them to describe what they already know.

RULE 2 — Diagnose before you teach.
Your first response to any new problem should be a diagnostic question —
ask what the student notices, knows, or thinks the first step might be.

RULE 3 — Handle errors without judgment.
When a student makes a mistake, never say "incorrect" or "wrong." Ask a
question that guides them to notice the error themselves.

RULE 4 — Ask one question at a time.
Never ask more than one question per response.

RULE 5 — Name what the student got right.
Before redirecting an error, acknowledge what the student understood correctly.

RULE 6 — Use the student's own language.
Work within their language first, then gently introduce the precise term
once they have the concept.

RULE 7 — Never skip steps to save time.
Each step the student works through themselves is a step they will remember.

LIVING UNDERSTANDING MAP:
When a student reaches the correct final answer, generate this block:

LIVING_UNDERSTANDING_MAP_START
TOPIC: [topic name]
UNDERSTOOD: [specific item] | [specific item] | [specific item]
GAP: [specific item] | [specific item]
NEXT: [specific actionable item] | [specific actionable item]
LIVING_UNDERSTANDING_MAP_END

[One warm closing sentence.]

Every item must be specific to what this student actually said or did.
If no gaps occurred, write: "No significant gaps identified."

TONE: Warm, patient, encouraging. Never say "Great question!" or "Excellent!"
Keep responses to 2-4 sentences plus one question. Brief is always better.

NEVER:
- Solve the problem directly, even if asked repeatedly
- Say "wrong" or "incorrect"
- Ask more than one question per response
- Produce the Living Understanding Map before the correct final answer
- Give generic feedback not grounded in this student's actual responses
`;

// ==========================================
// TYPES
// ==========================================
type Role = 'student' | 'mathbuddy';

interface Message {
  type: 'text' | 'map';
  role: Role;
  content: string | MapData;
}

interface MapData {
  TOPIC: string;
  UNDERSTOOD: string[];
  GAP: string[];
  NEXT: string[];
  closing: string;
}

// ==========================================
// UTILS
// ==========================================
const parseMap = (text: string): { mapData: MapData | null; before: string } => {
  const startTag = "LIVING_UNDERSTANDING_MAP_START";
  const endTag = "LIVING_UNDERSTANDING_MAP_END";
  
  const startIdx = text.indexOf(startTag);
  const endIdx = text.indexOf(endTag);
  
  if (startIdx === -1 || endIdx === -1) {
    return { mapData: null, before: text };
  }
  
  const block = text.substring(startIdx + startTag.length, endIdx).trim();
  const closing = text.substring(endIdx + endTag.length).trim();
  const before = text.substring(0, startIdx).trim();
  
  const lines = block.split('\n');
  const result: any = {
    UNDERSTOOD: [],
    GAP: [],
    NEXT: [],
    closing: closing
  };
  
  lines.forEach(line => {
    if (line.includes(':')) {
      const [key, val] = line.split(':');
      const k = key.trim();
      const v = val.trim();
      
      if (k === 'TOPIC') {
        result.TOPIC = v;
      } else if (k === 'UNDERSTOOD' || k === 'GAP' || k === 'NEXT') {
        result[k] = v.split('|').map(item => item.trim()).filter(Boolean);
      }
    }
  });
  
  return { mapData: result as MapData, before };
};

// ==========================================
// COMPONENTS
// ==========================================

const Header = () => (
  <header className="bg-cbc-navy border-b-3 border-cbc-gold px-6 py-4 -mx-6 -mt-6 mb-8 flex items-center gap-4">
    <div className="bg-cbc-gold w-10 h-10 rounded-full flex items-center justify-center font-serif font-extrabold text-cbc-navy text-xl">
      M
    </div>
    <div className="flex flex-col">
      <h1 className="font-serif font-bold text-2xl text-white leading-none">MathBuddy</h1>
      <span className="text-cbc-gold-bright text-[10px] uppercase tracking-widest font-semibold mt-0.5">
        Columbia Basin College
      </span>
    </div>
  </header>
);

const Footer = () => (
  <footer className="text-center py-8 mt-12 border-t border-cbc-border text-slate-400 text-[11px]">
    Columbia Basin College · MathBuddy · Powered by Google Gemini
  </footer>
);

const WelcomeScreen = ({ onSelectExample }: { onSelectExample: (text: string) => void }) => {
  const examples = [
    { id: 'ladder', text: "A 10-foot ladder leans against a wall. The bottom slides away at 2 ft/sec. How fast is the top sliding down when the bottom is 6 feet from the wall?" },
    { id: 'derivative', text: "Find the derivative of f(x) = x³ ln(x) using the product rule." },
    { id: 'log', text: "Solve: log₂(x + 3) + log₂(x - 1) = 5" }
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-cbc-navy w-20 h-20 rounded-full flex items-center justify-center text-cbc-gold text-4xl mb-6 shadow-[0_0_20px_rgba(184,151,59,0.3)] border-2 border-cbc-gold"
      >
        <Sigma size={36} />
      </motion.div>
      <motion.h2 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="font-serif font-bold text-3xl text-cbc-navy mb-2"
      >
        Hi! I'm MathBuddy.
      </motion.h2>
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-cbc-text-muted max-w-md mb-8 leading-relaxed"
      >
        I'm here to help you think through math problems — not just
        give you the answer. Select an example below or type your problem to get started.
      </motion.p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
        {examples.map((ex, idx) => (
          <motion.button
            key={ex.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 + idx * 0.1 }}
            onClick={() => onSelectExample(ex.text)}
            className="p-4 bg-white border border-cbc-border rounded-xl text-xs text-cbc-text hover:border-cbc-gold hover:shadow-md transition-all text-left h-full flex items-center"
          >
            {ex.text}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

const UnderstandingMap = ({ data }: { data: MapData }) => (
  <motion.div 
    initial={{ y: 30, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="bg-white border border-cbc-border rounded-2xl overflow-hidden my-6 shadow-[0_4px_20px_rgba(0,47,108,0.08)]"
  >
    <div className="bg-cbc-navy border-b-3 border-cbc-gold p-4 flex items-center gap-3">
      <div className="bg-cbc-gold w-7 h-7 rounded-full flex items-center justify-center text-cbc-navy">
        <Diamond size={16} fill="currentColor" />
      </div>
      <div className="flex flex-col">
        <h3 className="font-serif font-bold text-white text-lg leading-tight tracking-tight">Your Understanding Map</h3>
        <span className="text-cbc-gold-bright text-xs font-semibold">{data.TOPIC}</span>
      </div>
    </div>
    
    <div className="bg-[#E8F5EF] p-4 border-b border-cbc-border">
      <div className="text-[#1A6B45] text-[10px] font-bold uppercase tracking-wider mb-2">Understood</div>
      {data.UNDERSTOOD.map((item, i) => (
        <div key={i} className="text-cbc-text-muted text-sm flex gap-2 items-start mb-1">
          <span className="text-[#1A6B45] font-bold">→</span>
          {item}
        </div>
      ))}
    </div>

    <div className="bg-[#FBF3E0] p-4 border-b border-cbc-border">
      <div className="text-[#8B5E00] text-[10px] font-bold uppercase tracking-wider mb-2">Gap</div>
      {data.GAP.map((item, i) => (
        <div key={i} className="text-cbc-text-muted text-sm flex gap-2 items-start mb-1">
          <span className="text-[#8B5E00] font-bold">→</span>
          {item}
        </div>
      ))}
    </div>

    <div className="bg-[#E8EEF8] p-4 border-b border-cbc-border">
      <div className="text-[#1A3F7A] text-[10px] font-bold uppercase tracking-wider mb-2">Next Steps</div>
      {data.NEXT.map((item, i) => (
        <div key={i} className="text-cbc-text-muted text-sm flex gap-2 items-start mb-1">
          <span className="text-[#1A3F7A] font-bold">→</span>
          {item}
        </div>
      ))}
    </div>

    <div className="p-4 bg-white italic text-sm text-cbc-text-muted">
      {data.closing}
    </div>
  </motion.div>
);

// ==========================================
// MAIN APP
// ==========================================
export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }), []);

  const chat = useRef<any>(null);

  useEffect(() => {
    if (!chat.current) {
      chat.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_PROMPT,
        }
      });
    }
  }, [ai]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const newMsg: Message = { type: 'text', role: 'student', content: text };
    setMessages(prev => [...prev, newMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chat.current.sendMessage(text);
      const reply = response.text;
      
      const { mapData, before } = parseMap(reply);
      
      const newMessages: Message[] = [];
      if (before) {
        newMessages.push({ type: 'text', role: 'mathbuddy', content: before });
      }
      if (mapData) {
        newMessages.push({ type: 'map', role: 'mathbuddy', content: mapData });
      }
      
      setMessages(prev => [...prev, ...newMessages]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { 
        type: 'text', 
        role: 'mathbuddy', 
        content: "I'm having a little trouble connecting right now. Can we try that again?" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setMessages([]);
    chat.current = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_PROMPT,
      }
    });
  };

  return (
    <div className="min-h-screen bg-cbc-off-white flex flex-col max-w-3xl mx-auto px-6 pt-6 font-sans">
      <Header />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {messages.length === 0 ? (
          <WelcomeScreen onSelectExample={handleSendMessage} />
        ) : (
          <>
            <div className="flex justify-start mb-6">
              <button 
                onClick={handleStartOver}
                className="flex items-center gap-2 text-xs text-cbc-text-muted hover:text-cbc-navy transition-colors px-3 py-1.5 rounded-full border border-cbc-border bg-white"
              >
                <RotateCcw size={12} />
                Start over
              </button>
            </div>
            
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto pr-2 space-y-4 scroll-smooth pb-32 no-scrollbar"
              style={{ maxHeight: 'calc(100vh - 300px)' }}
            >
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${msg.role === 'student' ? 'justify-end ml-16' : 'justify-start mr-16'}`}
                  >
                    {msg.type === 'text' ? (
                      <div className={`
                        px-4 py-3 text-sm leading-relaxed
                        ${msg.role === 'student' 
                          ? 'bg-cbc-navy text-white rounded-2xl rounded-tr-none shadow-sm' 
                          : 'bg-white text-cbc-text border border-cbc-border border-l-3 border-l-cbc-gold rounded-2xl rounded-tl-none shadow-[0_2px_4px_rgba(0,0,0,0.05)]'}
                      `}>
                        <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content as string}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <UnderstandingMap data={msg.content as MapData} />
                      </div>
                    )}
                  </motion.div>
                ))}
                
                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start mr-16"
                  >
                    <div className="bg-white px-5 py-3 rounded-2xl rounded-tl-none border border-cbc-border border-l-3 border-l-cbc-gold flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 bg-cbc-gold rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                      <div className="w-1.5 h-1.5 bg-cbc-gold rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-1.5 h-1.5 bg-cbc-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 py-6 bg-gradient-to-t from-cbc-off-white via-cbc-off-white to-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto px-6 pointer-events-auto">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
            className="relative flex items-center group"
          >
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask MathBuddy..."
              className="w-full bg-white border border-cbc-border rounded-full py-4 pl-6 pr-14 text-sm shadow-[0_2px_15px_rgba(0,0,0,0.05)] focus:ring-2 focus:ring-cbc-gold focus:border-cbc-gold outline-none transition-all group-hover:shadow-md"
            />
            <button 
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 p-3 bg-cbc-navy text-white rounded-full hover:bg-opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md"
            >
              <Send size={18} />
            </button>
          </form>
          <Footer />
        </div>
      </div>
    </div>
  );
}
