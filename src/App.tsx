/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Languages, 
  ArrowRightLeft, 
  Copy, 
  Check, 
  X, 
  Image as ImageIcon, 
  FileText, 
  Mic, 
  Volume2, 
  Maximize2, 
  Upload,
  Globe,
  Loader2,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  History as HistoryIcon,
  Star,
  MessageSquare,
  ThumbsUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { 
  translateText, 
  translateFile, 
  generateGovResponse,
  generateDraftFromInstruction,
  LANGUAGES, 
  SupportedLanguage 
} from "./services/geminiService";
import { 
  auth, 
  signInWithGoogle, 
  logout, 
  saveTranslation, 
  getTranslationHistory, 
  deleteTranslation,
  getUserData,
  saveFeedback,
  saveDraft,
  getLatestDraft
} from "./services/firebaseService";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

type AppTab = "text" | "image" | "pdf" | "gov" | "history";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("text");
  const [govMode, setGovMode] = useState<"reply" | "noting">("reply");
  const [govInputMethod, setGovInputMethod] = useState<"file" | "text">("file");
  const [sourceLang, setSourceLang] = useState<SupportedLanguage>("English");
  const [targetLang, setTargetLang] = useState<SupportedLanguage>("Urdu");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileInstruction, setFileInstruction] = useState("");
  
  const [isPro, setIsPro] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackType, setFeedbackType] = useState<'accuracy' | 'suggestion'>('accuracy');
  const [lastTranslationId, setLastTranslationId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUseFeature = (tab: AppTab) => {
    if (tab === "gov") return isPro;
    return true;
  };

  // Auth and Data Fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userData = await getUserData(firebaseUser.uid);
        if (userData) {
          setIsPro(userData.isPro || false);
        }
        
        // Load latest draft
        const draft = await getLatestDraft();
        if (draft) {
          if (draft.activeTab) setActiveTab(draft.activeTab as AppTab);
          if (draft.inputText) setInputText(draft.inputText);
          if (draft.sourceLang) setSourceLang(draft.sourceLang as SupportedLanguage);
          if (draft.targetLang) setTargetLang(draft.targetLang as SupportedLanguage);
          if (draft.govMode) setGovMode(draft.govMode as any);
          if (draft.govInputMethod) setGovInputMethod(draft.govInputMethod as any);
          if (draft.fileInstruction) setFileInstruction(draft.fileInstruction);
        }

        fetchHistory();
      } else {
        setIsPro(false);
        setHistory([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (user && (inputText || fileInstruction)) {
      setIsSavingDraft(true);
      const timer = setTimeout(async () => {
        await saveDraft({
          activeTab,
          inputText,
          sourceLang,
          targetLang,
          govMode: activeTab === 'gov' ? govMode : undefined,
          govInputMethod: activeTab === 'gov' ? govInputMethod : undefined,
          fileInstruction: (activeTab === 'gov' || activeTab === 'image' || activeTab === 'pdf') ? fileInstruction : undefined
        });
        setIsSavingDraft(false);
      }, 2000); // Debounce auto-save
      return () => clearTimeout(timer);
    }
  }, [user, activeTab, inputText, sourceLang, targetLang, govMode, fileInstruction]);

  const fetchHistory = async () => {
    const data = await getTranslationHistory();
    setHistory(data);
  };

  const handleTabChange = (tab: AppTab) => {
    if (!canUseFeature(tab)) {
      setShowPricing(true);
      return;
    }
    setActiveTab(tab);
  };

  // Auto-translate text with debouncing
  useEffect(() => {
    if (activeTab === "text" && inputText.trim()) {
      const timer = setTimeout(() => {
        handleTranslate();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!inputText.trim()) {
      setOutputText("");
    }
  }, [inputText, sourceLang, targetLang, activeTab]);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    try {
      const result = await translateText(inputText, sourceLang, targetLang);
      setOutputText(result);
      
      if (user) {
        const docId = await saveTranslation({
          type: 'text',
          sourceText: inputText,
          resultText: result,
          sourceLang,
          targetLang
        }) as any; // Assuming it returns id if needed or I just trigger modal
        fetchHistory();
      }
      
      // Trigger feedback modal after a short delay
      setTimeout(() => setShowFeedbackModal(true), 1500);
    } catch (error) {
      console.error(error);
      setOutputText("Error during translation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    // Validate type based on active tab
    if (activeTab === "image" && !file.type.startsWith("image/")) return;
    if (activeTab === "pdf" && file.type !== "application/pdf") return;
    if (activeTab === "gov" && !file.type.startsWith("image/") && file.type !== "application/pdf") return;

    // Clean up old object URL if exists
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const processFile = async () => {
    if (govInputMethod === "file" && !selectedFile) return;
    if (govInputMethod === "text" && !fileInstruction.trim()) return;

    setIsLoading(true);
    try {
      let result = "";
      if (activeTab === "gov") {
        if (govInputMethod === "file" && selectedFile) {
          const base64 = await fileToBase64(selectedFile);
          result = await generateGovResponse(base64, selectedFile.type, govMode, targetLang, fileInstruction);
        } else {
          result = await generateDraftFromInstruction(govMode === "reply" ? "letter" : "noting", targetLang, fileInstruction);
        }
      } else if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        result = await translateFile(base64, selectedFile.type, targetLang, fileInstruction);
      }
      setOutputText(result);

      if (user) {
        await saveTranslation({
          type: activeTab,
          sourceText: fileInstruction || (selectedFile ? "(File processed)" : ""),
          resultText: result,
          targetLang,
          fileName: selectedFile?.name,
          fileType: selectedFile?.type,
          govMode: activeTab === 'gov' ? govMode : undefined,
          inputMethod: activeTab === 'gov' ? govInputMethod : undefined
        });
        fetchHistory();
      }
      
      // Trigger feedback modal
      setTimeout(() => setShowFeedbackModal(true), 1500);
    } catch (error) {
      console.error(error);
      setOutputText("Error processing request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const swapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    // Also swap content if possible
    if (outputText) {
      setInputText(outputText);
      setOutputText(inputText);
    }
  };

  const speak = (text: string, lang: SupportedLanguage) => {
    if (!text || !window.speechSynthesis) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map supported languages to BCP 47 tags
    const langMap: Record<string, string> = {
      "English": "en-US",
      "Hindi": "hi-IN",
      "Urdu": "ur-PK"
    };

    utterance.lang = langMap[lang] || "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setInputText("");
    setOutputText("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileInstruction("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFeedbackSubmit = async () => {
    await saveFeedback({
      rating: feedbackRating,
      comment: feedbackComment,
      type: feedbackType
    });
    setShowFeedbackModal(false);
    setFeedbackRating(0);
    setFeedbackComment("");
    // In a real app we might show a toast here
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    // Map sourceLang strings to BCP 47 language tags
    const langMap: Record<string, string> = {
      "English": "en-US",
      "Urdu": "ur-PK",
      "Hindi": "hi-IN",
      "Detect Language": "en-US"
    };
    
    recognition.lang = langMap[sourceLang] || "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev + (prev ? " " : "") + transcript);
    };

    recognition.start();
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-100/50">
      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl shadow-blue-900/10 overflow-hidden border border-neutral-100"
            >
              <div className="p-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight mb-2">Share your thoughts</h2>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">Your feedback helps us refine the intelligence</p>
                  </div>
                  <button onClick={() => setShowFeedbackModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Rating */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300">How accurate was the result?</label>
                    <div className="flex gap-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setFeedbackRating(star)}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                            feedbackRating >= star ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-neutral-50 text-neutral-300 hover:bg-neutral-100"
                          }`}
                        >
                          <Star className={`w-5 h-5 ${feedbackRating >= star ? "fill-white" : ""}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback Type */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300">Feedback Category</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFeedbackType('accuracy')}
                        className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          feedbackType === 'accuracy' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-neutral-100 text-neutral-400'
                        }`}
                      >
                        Quality
                      </button>
                      <button
                        onClick={() => setFeedbackType('suggestion')}
                        className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          feedbackType === 'suggestion' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-neutral-100 text-neutral-400'
                        }`}
                      >
                        Feature
                      </button>
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300">Tell us more (Optional)</label>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Help us improve..."
                      className="w-full p-6 bg-neutral-50 border border-neutral-100 rounded-[2rem] text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none h-32"
                    />
                  </div>

                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={feedbackRating === 0}
                    className={`w-full py-5 rounded-[2rem] text-white font-black text-xs uppercase tracking-[0.3em] transition-all shadow-xl ${
                      feedbackRating > 0 ? "bg-neutral-900 hover:bg-black shadow-neutral-200" : "bg-neutral-200 cursor-not-allowed"
                    }`}
                  >
                    Submit Feedback
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="glass border-b border-neutral-200 sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-blue-600 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative p-2.5 bg-neutral-900 rounded-2xl flex items-center justify-center transform group-hover:-rotate-6 transition-transform duration-500 shadow-xl border border-white/10">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-neutral-900 flex items-baseline">
              Translator<span className="text-blue-600">.com</span>
            </h1>
          </div>
          <div className="flex items-center gap-8">
            <nav className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
              <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
              <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
              {user && (
                <button 
                  onClick={() => handleTabChange("history")} 
                  className={`hover:text-blue-600 transition-colors ${activeTab === 'history' ? 'text-blue-600' : ''}`}
                >
                  History
                </button>
              )}
              <a href="#contact" className="hover:text-blue-600 transition-colors">Support</a>
            </nav>
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[10px] font-black text-neutral-900 leading-none">{user.displayName}</span>
                  <span className="text-[8px] font-bold text-blue-600 uppercase tracking-widest">{isPro ? 'PRO Administrator' : 'Standard User'}</span>
                </div>
                <button 
                  onClick={logout}
                  className="group relative h-10 w-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-500 shadow-inner overflow-hidden hover:border-red-200 transition-colors"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.displayName?.[0] || 'U'}</span>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <X className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors flex items-center gap-2"
              >
                <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-600 rounded-sm" />
                </div>
                Login with Google
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-40 overflow-hidden bg-mesh perspective-2000">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none preserve-3d">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotateZ: [0, 10, 0],
              z: [0, 50, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/10 blur-[120px] rounded-full"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              rotateY: [0, 45, 0],
              z: [0, -100, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-orange-400/10 blur-[130px] rounded-full"
          />
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10 preserve-3d">
          <motion.div 
            initial={{ opacity: 0, y: 20, translateZ: 100 }}
            animate={{ opacity: 1, y: 0, translateZ: 0 }}
            className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white shadow-xl shadow-blue-900/5 border border-blue-50 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-10"
          >
            <div className="flex -space-x-2">
              <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white" />
              <div className="w-5 h-5 rounded-full bg-orange-500 border-2 border-white" />
              <div className="w-5 h-5 rounded-full bg-neutral-900 border-2 border-white" />
            </div>
            <span>Empowering the Asian Language Bridge</span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 60, damping: 20 }}
            className="relative preserve-3d"
          >
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.85] text-neutral-900 perspective-1000">
              Translate text, <span className="relative inline-block hover:scale-110 transition-transform duration-500 cursor-default">
                letters
                <motion.span 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  className="absolute bottom-4 left-0 h-3 bg-blue-600/10 -z-10 rounded-full"
                />
              </span> <br /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-400 to-neutral-200">and institutional data.</span>
            </h1>
            
            {/* Floating 3D UI Badges */}
            <motion.div 
              animate={{ 
                y: [0, -15, 0],
                rotateY: [-5, 5, -5],
                z: [20, 50, 20]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 left-10 hidden xl:flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-mega border border-neutral-100 preserve-3d"
            >
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">System Online</span>
            </motion.div>
            
            <motion.div 
              animate={{ 
                y: [0, 15, 0],
                rotateX: [0, 10, 0],
                z: [40, 70, 40]
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-10 right-20 hidden xl:flex items-center gap-3 px-5 py-3 bg-neutral-900 rounded-3xl shadow-2xl text-white preserve-3d"
            >
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Powered by Gemini Pro</span>
            </motion.div>

            {/* Additional 3D Floating Elements */}
            <motion.div
              animate={{ 
                rotateY: [0, 360],
                y: [0, -20, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute top-20 -right-10 hidden 2xl:block p-4 bg-blue-50 rounded-2xl border border-blue-100 shadow-xl opacity-40 blur-[1px]"
            >
              <Globe className="w-8 h-8 text-blue-600" />
            </motion.div>

            <motion.div
              animate={{ 
                rotateX: [0, 360],
                x: [0, 30, 0]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-20 -left-20 hidden 2xl:block p-5 bg-orange-50 rounded-full border border-orange-100 shadow-xl opacity-30 blur-[2px]"
            >
              <Sparkles className="w-10 h-10 text-orange-500" />
            </motion.div>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0, y: 20, z: -20 }}
            animate={{ opacity: 1, y: 0, z: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-neutral-400 font-medium max-w-2xl mx-auto mb-16 leading-relaxed"
          >
            The world's first AI translator designed for official Hindi, Urdu, and English 
            documentation. From casual chats to complex sanchikas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={() => document.getElementById('translation-tool')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-10 py-5 bg-neutral-900 text-white rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-black hover:shadow-2xl hover:shadow-neutral-400 transition-all active:scale-95 shadow-xl shadow-neutral-200"
            >
              Start Translating
            </button>
            <button 
              onClick={() => setShowPricing(true)}
              className="px-10 py-5 bg-white text-neutral-900 border border-neutral-100 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-neutral-50 transition-all active:scale-95 shadow-lg shadow-neutral-100"
            >
              View Pricing
            </button>
          </motion.div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 pb-24">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <TabButton 
            active={activeTab === "text"} 
            onClick={() => handleTabChange("text")}
            icon={<Languages className="w-4 h-4" />}
            label="Text"
          />
          <TabButton 
            active={activeTab === "image"} 
            onClick={() => handleTabChange("image")}
            icon={<ImageIcon className="w-4 h-4" />}
            label="Photos"
          />
          <TabButton 
            active={activeTab === "pdf"} 
            onClick={() => handleTabChange("pdf")}
            icon={<FileText className="w-4 h-4" />}
            label="PDFs"
          />
          <TabButton 
            active={activeTab === "gov"} 
            onClick={() => handleTabChange("gov")}
            icon={<Globe className="w-4 h-4" />}
            label="Government"
            variant="gov"
            isPro={!isPro}
          />
          {user && (
            <TabButton 
              active={activeTab === "history"} 
              onClick={() => handleTabChange("history")}
              icon={<HistoryIcon className="w-4 h-4" />}
              label="History"
              variant="blue"
            />
          )}
        </div>

        {/* Translation Container */}
        <motion.div 
          id="translation-tool"
          layout
          className="bg-white rounded-[3rem] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.08)] border border-neutral-100 overflow-hidden min-h-[580px] flex flex-col relative scroll-mt-32 depth-card"
          initial={{ rotateX: 5, y: 50, opacity: 0 }}
          whileInView={{ rotateX: 0, y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Subtle brand accent */}
          <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-500 ${activeTab === 'gov' ? 'bg-orange-500' : 'bg-blue-600'}`} />
          
          {/* Tabs Content */}
          <AnimatePresence mode="wait">
            {activeTab === "history" ? (
              <motion.div
                key="history-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 p-8 flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black tracking-tight">Translation History</h3>
                  <div className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">{history.length} Saved Items</div>
                </div>
                
                {history.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-neutral-300 gap-4">
                    <HistoryIcon className="w-12 h-12 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-[0.2em]">Your journey will appear here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto max-h-[600px] pr-4">
                    {history.map((item) => (
                      <div 
                        key={item.id} 
                        className="group relative p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 hover:border-blue-200 transition-all hover:shadow-xl hover:shadow-blue-50/50"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                            {item.type === 'text' && <Languages className="w-3.5 h-3.5 text-blue-600" />}
                            {item.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-orange-600" />}
                            {item.type === 'pdf' && <FileText className="w-3.5 h-3.5 text-red-600" />}
                            {item.type === 'gov' && <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />}
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                              {item.createdAt?.toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={() => { deleteTranslation(item.id); setHistory(prev => prev.filter(h => h.id !== item.id)); }}
                            className="p-1.5 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-neutral-800 line-clamp-2 leading-relaxed">
                            {item.type === 'gov' ? `${item.govMode === 'reply' ? 'Official Draft' : 'Noting Sheet'}: ${item.fileName || 'Document'}` : (item.sourceText || "Untitled")}
                          </p>
                          <div className="h-px bg-neutral-200/50 w-full" />
                          <p className="text-[11px] text-neutral-500 line-clamp-3 leading-relaxed italic">
                            {item.resultText}
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            setInputText(item.sourceText || "");
                            setOutputText(item.resultText);
                            setActiveTab('text');
                            if (item.targetLang) setTargetLang(item.targetLang as any);
                          }}
                          className="mt-4 w-full py-2 bg-white border border-neutral-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-neutral-400 hover:text-blue-600 hover:border-blue-100 transition-all"
                        >
                          Restore Translation
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="main-tabs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                {/* Language Selector Bar */}
                <div className="flex items-center justify-center py-6 px-10 border-b border-neutral-50 bg-neutral-50/30">
                  <div className="flex items-center gap-4 md:gap-16 w-full max-w-5xl justify-between">
                    {activeTab === "gov" ? (
                      <div className="flex flex-col w-full gap-4">
                        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
                          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-sm">
                            <button 
                              onClick={() => setGovMode("reply")}
                              className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${govMode === "reply" ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"}`}
                            >
                              Official Draft
                            </button>
                            <button 
                              onClick={() => setGovMode("noting")}
                              className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${govMode === "noting" ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"}`}
                            >
                              Noting Sheet
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-2xl">
                            <button 
                              onClick={() => setGovInputMethod("file")}
                              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${govInputMethod === "file" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                            >
                              Upload Letter
                            </button>
                            <button 
                              onClick={() => setGovInputMethod("text")}
                              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${govInputMethod === "text" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                            >
                              Direct Instructions
                            </button>
                          </div>

                          <div className="flex items-center gap-3 bg-orange-50/50 px-6 py-2.5 rounded-2xl border border-orange-100 shadow-sm group hover:border-orange-300 transition-all">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest hidden sm:block">Language:</span>
                            <div className="flex items-center gap-2">
                              <select
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
                                className="bg-transparent text-sm font-black text-neutral-800 hover:text-orange-600 cursor-pointer outline-none min-w-[100px] transition-colors appearance-none"
                              >
                                {LANGUAGES.map(lang => (
                                  <option key={lang} value={lang}>{lang}</option>
                                ))}
                              </select>
                              <Languages className="w-4 h-4 text-orange-400" />
                            </div>
                          </div>
                        </div>
                        {govInputMethod === "text" && (
                          <div className="px-2">
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">DRAFTING INSTRUCTIONS IN HINDI/URDU/ENGLISH:</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 flex justify-start items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          <select
                            value={sourceLang}
                            onChange={(e) => setSourceLang(e.target.value as SupportedLanguage)}
                            className="bg-transparent text-sm font-black text-neutral-800 hover:text-blue-600 cursor-pointer outline-none min-w-[160px] transition-colors appearance-none"
                          >
                            <option value="Detect Language">Auto Detection</option>
                            {LANGUAGES.map(lang => (
                              <option key={lang} value={lang}>{lang}</option>
                            ))}
                          </select>
                        </div>

                        <button 
                          onClick={swapLanguages}
                          className="p-4 rounded-full bg-neutral-50 hover:bg-blue-600 text-neutral-400 hover:text-white transition-all active:scale-90 border border-neutral-100 hover:border-blue-600 hover:shadow-xl hover:shadow-blue-200"
                        >
                          <ArrowRightLeft className="w-5 h-5" />
                        </button>

                        <div className="flex-1 flex justify-end items-center gap-3">
                          <select
                            value={targetLang}
                            onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
                            className="bg-transparent text-sm font-black text-neutral-800 hover:text-blue-600 cursor-pointer outline-none min-w-[160px] text-right transition-colors appearance-none"
                          >
                            {LANGUAGES.map(lang => (
                              <option key={lang} value={lang}>{lang}</option>
                            ))}
                          </select>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Input & Output Area */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
                  {/* Input Side */}
                  <div className={`relative p-8 group flex flex-col transition-colors duration-500 ${sourceLang === "Urdu" ? "text-right" : "text-left"}`}>
                    <AnimatePresence mode="wait">
                      {activeTab === "text" ? (
                        <motion.div
                          key="text-input-wrap"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="flex-1 flex flex-col"
                        >
                          <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={sourceLang === "Urdu" ? "ترجمہ کرنے کے لیے یہاں لکھیں..." : "Type text to translate..."}
                            dir={sourceLang === "Urdu" ? "rtl" : "ltr"}
                            className={`flex-1 w-full min-h-[350px] text-3xl font-normal resize-none focus:outline-none placeholder:text-neutral-200 transition-all leading-tight ${sourceLang === "Urdu" ? "font-urdu" : ""}`}
                          />
                          {isSavingDraft && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute bottom-2 left-8 flex items-center gap-2 text-neutral-300 pointer-events-none"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
                              <span className="text-[9px] font-bold uppercase tracking-widest">Saving...</span>
                            </motion.div>
                          )}
                        </motion.div>
                      ) : activeTab === "gov" && govInputMethod === "text" ? (
                        <motion.div
                          key="gov-text-input"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex-1 flex flex-col pt-2"
                        >
                          <textarea
                            value={fileInstruction}
                            onChange={(e) => setFileInstruction(e.target.value)}
                            placeholder={targetLang === "Urdu" ? "ڈرافٹ بنانے کے لیے ہدایات یہاں لکھیں... مثلاً: 'میونسپل کمشنر کے نام ایک خط لکھیں پانی کے مسائل کے بارے میں'" : targetLang === "Hindi" ? "ड्राफ्ट बनाने के लिए निर्देश यहाँ लिखें... जैसे: 'पानी की समस्या के बारे में नगर आयुक्त को एक पत्र लिखें'" : "Write instructions for drafting... e.g. 'Write a letter to the Municipal Commissioner about water issues'"}
                            dir={targetLang === "Urdu" ? "rtl" : "ltr"}
                            className={`flex-1 w-full min-h-[350px] text-2xl font-normal resize-none focus:outline-none placeholder:text-neutral-200 transition-all leading-relaxed ${targetLang === "Urdu" ? "font-urdu" : ""}`}
                          />
                          <button 
                            onClick={processFile}
                            disabled={isLoading || !fileInstruction.trim()}
                            className={`mt-4 py-5 rounded-3xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 bg-neutral-900 text-white ${isLoading || !fileInstruction.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-black shadow-neutral-200 hover:translate-y-[-2px]"}`}
                          >
                            {isLoading ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Sparkles className="w-5 h-5 text-orange-400" />
                            )}
                            {isLoading ? "Generating Draft..." : "Generate Official Draft"}
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="file-input-wrap"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className={`flex-1 min-h-[350px] flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl transition-all cursor-pointer group/upload bg-neutral-50/50 ${
                            activeTab === 'gov' ? 'border-orange-100 hover:border-orange-300 hover:bg-orange-50/20' : 'border-neutral-100 hover:border-blue-200 hover:bg-blue-50/20'
                          }`}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e); }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept={activeTab === "image" ? "image/*" : ".pdf"}
                            capture={activeTab === "image" ? "environment" : undefined}
                            onChange={handleFileUpload}
                          />
                          
                          {selectedFile ? (
                            <div className="w-full h-full flex flex-col items-center justify-between">
                              <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full overflow-hidden">
                                {previewUrl ? (
                                  selectedFile.type === "application/pdf" ? (
                                    <div className="w-full h-[350px] rounded-2xl overflow-hidden border border-neutral-100 shadow-inner bg-neutral-200">
                                      <iframe 
                                        src={`${previewUrl}#toolbar=0`} 
                                        className="w-full h-full" 
                                        title="PDF Preview"
                                      />
                                    </div>
                                  ) : (
                                    <div className="relative group/preview" onClick={(e) => { e.stopPropagation(); setShowImagePreview(true); }}>
                                      <img src={previewUrl} alt="Preview" className="max-h-56 rounded-2xl shadow-xl border border-white group-hover/preview:scale-105 transition-transform duration-500" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 rounded-2xl flex items-center justify-center transition-opacity">
                                        <Maximize2 className="text-white w-6 h-6" />
                                      </div>
                                    </div>
                                  )
                                ) : (
                                  <div className="p-8 bg-blue-100/50 rounded-3xl border border-blue-200 flex items-center justify-center">
                                    <FileText className="w-12 h-12 text-blue-600" />
                                  </div>
                                )}
                                <div className="text-center px-4">
                                  <p className="text-sm font-bold text-neutral-800 truncate max-w-xs">{selectedFile.name}</p>
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Ready to process</span>
                                </div>
                              </div>
                              
                              <div className="w-full space-y-6 pt-8">
                                <div className="relative">
                                  <textarea
                                    value={fileInstruction}
                                    onChange={(e) => setFileInstruction(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Any specific instructions? (e.g. 'high formality', 'summarize')"
                                    className="w-full p-4 bg-white/80 border border-neutral-100 rounded-2xl text-xs focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none h-24 shadow-sm"
                                  />
                                  <div className="absolute top-3 right-3">
                                    <Mic className="w-3.5 h-3.5 text-neutral-300" />
                                  </div>
                                  {isSavingDraft && (
                                    <div className="absolute bottom-2 right-4 flex items-center gap-1.5 text-neutral-300">
                                      <div className="w-1 h-1 rounded-full bg-blue-300 animate-pulse" />
                                      <span className="text-[8px] font-bold uppercase tracking-widest">Draft Saved</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); processFile(); }}
                                    disabled={isLoading}
                                    className={`flex-1 py-4 rounded-2xl text-white font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                      activeTab === 'gov' ? 'bg-orange-600 shadow-orange-200' : 'bg-blue-600 shadow-blue-200'
                                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:translate-y-[-2px]'}`}
                                  >
                                    {isLoading ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>System working...</span>
                                      </>
                                    ) : (
                                      <span>{activeTab === 'gov' ? 'Generate Official Draft' : 'Process & Translate'}</span>
                                    )}
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); clearAll(); }}
                                    className="p-4 rounded-2xl bg-neutral-100 text-neutral-400 hover:text-red-500 hover:bg-neutral-200 transition-all border border-transparent hover:border-red-100"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className={`p-8 rounded-[2.5rem] ${activeTab === 'gov' ? 'bg-orange-50' : 'bg-neutral-100/50'} group-hover/upload:scale-110 group-hover/upload:rotate-3 transition-all duration-500 mb-6 border border-transparent group-hover/upload:border-blue-100`}>
                                <Upload className={`w-12 h-12 ${activeTab === 'gov' ? 'text-orange-500' : 'text-neutral-400 group-hover/upload:text-blue-500'} transition-colors`} />
                              </div>
                              <h3 className="text-xl font-bold text-neutral-800 mb-2 text-center tracking-tight">
                                {activeTab === "gov" ? "Process Government Letter" : `Select ${activeTab === "image" ? "Photo" : "Document"}`}
                              </h3>
                              <p className="text-xs font-medium text-neutral-400 text-center max-w-xs leading-relaxed uppercase tracking-wider">
                                {activeTab === "gov" 
                                  ? "AI will analyze the hierarchy and draft professional responses" 
                                  : `Drag or click to ${activeTab === "image" ? "extract and translate" : "analyze your document"}`}
                              </p>
                              {activeTab === "image" && (
                                <div className="mt-8 flex gap-3">
                                  <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-100">Supports JPG, PNG, WEBP</div>
                                </div>
                              )}
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="absolute bottom-6 left-8 flex items-center gap-6 text-neutral-300">
                      <button 
                        onClick={toggleListening}
                        className={`transition-all p-2 rounded-full ${isListening ? 'text-red-500 bg-red-50 animate-pulse ring-4 ring-red-100' : 'hover:text-blue-600 hover:bg-blue-50'}`}
                      >
                        <Mic className={`w-5 h-5 ${isListening ? 'fill-red-500' : ''}`} />
                      </button>
                      <button 
                        onClick={() => speak(inputText, sourceLang === "Detect Language" ? "English" : sourceLang)}
                        className="hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-full"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                      {inputText && (
                        <button onClick={() => setInputText("")} className="hover:text-red-500 transition-colors flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-widest pl-4 border-l border-neutral-100">
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="absolute bottom-6 right-8 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-200 border border-neutral-100 px-2 py-0.5 rounded-md">
                      {inputText.length} C
                    </div>
                  </div>

                  {/* Output Side */}
                  <div className={`relative p-8 bg-neutral-50/30 transition-all duration-500 overflow-hidden flex flex-col ${targetLang === "Urdu" ? "text-right" : "text-left"}`} dir={targetLang === "Urdu" ? "rtl" : "ltr"}>
                    {isLoading ? (
                      <div className="h-full min-h-[350px] flex flex-col items-center justify-center gap-6 text-neutral-400">
                        <div className="relative">
                          <div className="absolute inset-0 bg-blue-100 blur-2xl opacity-50 animate-pulse"></div>
                          <Loader2 className="w-12 h-12 animate-spin text-blue-600 relative z-10" />
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-xs font-bold uppercase tracking-widest text-neutral-600">Artificial Intelligence</p>
                          <p className="text-[10px] uppercase tracking-[0.2em]">
                            {activeTab === 'gov' ? 'Analyzing official hierarchy...' : 
                             activeTab === 'image' ? 'Extracting text from image...' : 
                             'Processing language vectors...'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className={`h-full min-h-[350px] overflow-y-auto px-1 ${targetLang === "Urdu" ? "font-urdu" : "leading-tight"} ${!outputText ? 'text-neutral-200 italic text-2xl font-light items-center justify-center flex' : 'text-neutral-800'}`}>
                        {outputText ? (
                          <div className="markdown-body w-full">
                            <Markdown>{outputText}</Markdown>
                          </div>
                        ) : (
                          <span>{targetLang === "Urdu" ? "نتائج یہاں ظاہر ہوں گے..." : "Result will appear here..."}</span>
                        )}
                      </div>
                    )}

                    <div className={`absolute bottom-6 ${targetLang === "Urdu" ? "right-8" : "left-8"} flex items-center gap-6 text-neutral-300`} dir="ltr">
                      <button 
                        onClick={copyToClipboard}
                        className={`hover:text-blue-600 transition-all p-3 rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-blue-50 border border-transparent hover:border-blue-50 ${copied ? 'text-green-600 bg-white shadow-lg border-green-50' : ''}`}
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => speak(outputText, targetLang)}
                          className="hover:text-blue-600 transition-colors p-3 hover:bg-white rounded-2xl border border-transparent hover:border-neutral-100"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                        <button className="hover:text-blue-600 transition-colors p-3 hover:bg-white rounded-2xl border border-transparent hover:border-neutral-100"><Maximize2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className={`absolute bottom-6 ${targetLang === "Urdu" ? "left-8" : "right-8"} text-[9px] font-black uppercase tracking-[0.2em] text-neutral-200 border border-neutral-100 px-2 py-0.5 rounded-md`} dir="ltr">
                      {outputText.length} C
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Introduction Section */}
        <section id="about" className="mt-48 scroll-mt-24">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 space-y-10">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-none">A bridge between <br /> <span className="text-blue-600">bureaucracy and people.</span></h2>
              </div>
              <p className="text-lg text-neutral-500 font-medium leading-relaxed max-w-xl">
                We believe language shouldn't be a barrier to official progress. Translator.com 
                uses advanced LLMs specifically tuned for Indian administrative contexts.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="p-6 rounded-3xl bg-white border border-neutral-100 shadow-sm transition-shadow hover:shadow-md">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                    <Globe className="text-blue-600 w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-neutral-800 mb-2">99.8% Accuracy</h4>
                  <p className="text-neutral-500 text-xs leading-relaxed">Tuned on official gazettes and documents for zero-error terminology.</p>
                </div>
                <div className="p-6 rounded-3xl bg-white border border-neutral-100 shadow-sm transition-shadow hover:shadow-md">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
                    <ShieldCheck className="text-orange-600 w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-neutral-800 mb-2">Private & Secure</h4>
                  <p className="text-neutral-500 text-xs leading-relaxed">Enterprise-grade encryption for all uploaded government letters.</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-blue-600/5 blur-[100px] rounded-full scale-150" />
              <div className="relative bg-white rounded-[3rem] p-1 shadow-mega border border-neutral-100 overflow-hidden">
                <div className="bg-neutral-50 rounded-[2.8rem] p-10">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="space-y-4">
                      <div className="h-6 bg-neutral-200 rounded-full w-3/4 animate-pulse" />
                      <div className="h-6 bg-neutral-200 rounded-full w-1/2 animate-pulse" />
                      <div className="h-6 bg-neutral-200 rounded-full w-5/6 animate-pulse" />
                    </div>
                    <div className="pt-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                          <Check className="text-white w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Analysis Complete</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600 font-black text-[9px] uppercase tracking-widest">Official Draft</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="mt-56 scroll-mt-24">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-5xl font-black tracking-tight">Scale your communication.</h2>
            <p className="text-neutral-400 font-bold uppercase text-[11px] tracking-[0.4em]">One bridge, two ways to cross</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white p-12 rounded-[3.5rem] border border-neutral-100 shadow-xl hover:shadow-2xl transition-all duration-500 relative group overflow-hidden">
              <div className="space-y-10 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black mb-1">Standard</h3>
                    <p className="text-sm text-neutral-400 font-medium">For essential translation</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-neutral-50 text-neutral-400">
                    <Globe className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black italic">Free</span>
                  <span className="text-neutral-300 font-bold text-sm uppercase">Forever</span>
                </div>
                <ul className="space-y-5">
                  <PricingItem label="Unlimited Text Base" included />
                  <PricingItem label="Auto Detect Engine" included />
                  <PricingItem label="Voice to Text" included />
                  <PricingItem label="Standard Logic" included />
                  <PricingItem label="Official Drafting" />
                  <PricingItem label="Noting Sheets" />
                </ul>
                <button 
                  disabled
                  className="w-full py-5 rounded-2xl bg-neutral-50 text-neutral-400 font-black text-xs uppercase tracking-[0.2em] transition-all"
                >
                  Your Active Plan
                </button>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="bg-neutral-900 border border-neutral-800 p-12 rounded-[3.5rem] shadow-mega hover:shadow-[0_45px_90px_-20px_rgba(0,0,0,0.3)] transition-all duration-500 relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full -mr-32 -mt-32 blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="space-y-10 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-1">Professional</h3>
                    <p className="text-sm text-neutral-500 font-medium">For serious administrators</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20">
                    <Maximize2 className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black italic text-white">₹99</span>
                    <span className="text-neutral-500 font-bold text-sm uppercase">/ Month</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    First month free trial for new users
                  </p>
                </div>
                <ul className="space-y-5">
                  <PricingItem label="Everything in Standard" included inverted />
                  <PricingItem label="Official Letter Logic" included inverted />
                  <PricingItem label="Professional Noting" included inverted />
                  <PricingItem label="Administrative OCR" included inverted />
                  <PricingItem label="Priority LLM Speed" included inverted />
                  <PricingItem label="Bulk PDF Export" included inverted />
                </ul>
                <button 
                  onClick={() => { setIsPro(true); setShowPricing(false); }}
                  className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/30 hover:bg-blue-500 hover:scale-[1.02] transition-all active:scale-[0.98]"
                >
                  Start 30-Day Free Trial
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Contact/Support Section */}
        <div id="contact" className="mt-40 mb-20 scroll-mt-24">
          <div className="bg-neutral-900 rounded-[3.5rem] p-12 md:p-20 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] -mr-40 -mb-40" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
              <div className="space-y-8">
                <h2 className="text-5xl font-black tracking-tighter leading-none">Need help from our AI agents?</h2>
                <p className="text-neutral-400 font-medium text-lg max-w-md">Our support team and AI assistance are available 24/7 for technical queries or custom enterprise setups.</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm font-bold text-neutral-300">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><Globe className="w-5 h-5" /></div>
                    support@translator.com
                  </div>
                  <div className="flex items-center gap-4 text-sm font-bold text-neutral-300">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><Check className="w-5 h-5" /></div>
                    Response time: &lt; 2 hours
                  </div>
                </div>
              </div>
              <div className="bg-white/5 rounded-3xl p-8 border border-white/10">
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); }}>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Name" className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 transition-colors" required />
                    <input type="email" placeholder="Email" className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 transition-colors" required />
                  </div>
                  <textarea placeholder="How can we help you?" className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 transition-colors resize-none" required />
                  <button className="w-full py-4 bg-blue-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-500 transition-colors">Send AI Inquiry</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pricing Modal */}
      <AnimatePresence>
        {showPricing && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPricing(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="relative z-10 text-center space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
                  <Maximize2 className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight mb-2">Government Assistant</h2>
                  <p className="text-neutral-500 font-medium leading-relaxed">
                    AI-powered Official Letter Drafting and Noting Sheets are available exclusively for our Professional members. 
                    Upgrade now to unlock professional administrative tools.
                  </p>
                </div>
                <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Monthly Plan</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-black">₹99 <span className="text-xs font-bold text-neutral-400">/ month</span></p>
                      <span className="text-[9px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded-full">FREE 1st MONTH</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsPro(true); setShowPricing(false); }}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform"
                  >
                    Start Free Trial
                  </button>
                </div>
                <button 
                  onClick={() => setShowPricing(false)}
                  className="text-xs font-bold text-neutral-300 hover:text-neutral-500 transition-colors uppercase tracking-widest"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showImagePreview && previewUrl && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setShowImagePreview(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={previewUrl} alt="Full Preview" className="w-full h-full object-contain" />
              <button 
                onClick={() => setShowImagePreview(false)}
                className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all shadow-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-40 border-t border-neutral-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="max-w-sm space-y-4">
              <h2 className="text-3xl font-black italic tracking-tighter">Translator<span className="text-blue-600">.com</span></h2>
              <p className="text-sm text-neutral-400 font-medium leading-relaxed uppercase tracking-widest leading-loose">Empowering linguistic connectivity through high-performance artificial intelligence.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-16">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-300">System</h4>
                <ul className="space-y-2 text-xs font-bold text-neutral-600">
                  <li><a href="#about" className="hover:text-blue-600 transition-colors">About Us</a></li>
                  <li><a href="#pricing" className="hover:text-blue-600 transition-colors">Premium Plans</a></li>
                  <li><a href="#contact" className="hover:text-blue-600 transition-colors">Privacy Cloud</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-300">Support</h4>
                <ul className="space-y-2 text-xs font-bold text-neutral-600">
                  <li><a href="#contact" className="hover:text-blue-600 transition-colors">Help Center</a></li>
                  <li><a href="#contact" className="hover:text-blue-600 transition-colors">API Access</a></li>
                  <li><a href="#contact" className="hover:text-blue-600 transition-colors">Mobile App</a></li>
                </ul>
              </div>
              <div className="space-y-4 col-span-2 md:col-span-1">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-300">Platform</h4>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded bg-neutral-50 border border-neutral-100"></div>
                  <div className="w-8 h-8 rounded bg-neutral-50 border border-neutral-100"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-20 pt-8 border-t border-neutral-50 flex flex-col md:flex-row justify-between gap-4 text-[10px] font-black uppercase tracking-widest text-neutral-300">
            <div>© 2026 Translator.com • All Rights Reserved</div>
            <div>Designed for Precision • Powered by Google Gemini</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, variant = "blue", isPro }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string,
  variant?: "blue" | "gov",
  isPro?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 border relative ${
        active 
          ? variant === "gov" 
            ? "bg-orange-50 text-orange-600 border-orange-100 shadow-lg shadow-orange-100/50" 
            : "bg-blue-50 text-blue-600 border-blue-100 shadow-lg shadow-blue-100/50" 
          : "bg-white text-neutral-400 hover:text-neutral-600 border-transparent hover:bg-neutral-50"
      }`}
    >
      <span className={active ? "scale-110 transition-transform" : ""}>{icon}</span>
      {label}
      {isPro && !active && (
        <span className="absolute -top-1 -right-1 bg-neutral-900 text-white text-[7px] px-1.5 py-0.5 rounded-full z-10">PRO</span>
      )}
    </button>
  );
}

function PricingItem({ label, included, inverted }: { label: string, included?: boolean, inverted?: boolean }) {
  return (
    <li className={`flex items-center gap-3 text-sm font-bold ${inverted ? 'text-blue-50' : 'text-neutral-600'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${included ? (inverted ? 'bg-white' : 'bg-green-100') : 'bg-neutral-100 opacity-30'}`}>
        {included && <Check className={`w-3 h-3 ${inverted ? 'text-blue-600' : 'text-green-600'}`} />}
      </div>
      <span className={!included ? 'opacity-30' : ''}>{label}</span>
    </li>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="group p-10 rounded-[3rem] bg-white border border-neutral-100 shadow-sm hover:shadow-2xl hover:shadow-blue-50 transition-all duration-500 hover:translate-y-[-12px] relative overflow-hidden perspective-1000 preserve-3d">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
      <div className="relative z-10 preserve-3d group-hover:translateZ(30px) transition-transform duration-500">
        <div className="w-16 h-16 rounded-[1.5rem] bg-neutral-900 flex items-center justify-center mb-8 border border-white/10 group-hover:rotate-12 transition-all duration-500 shadow-xl shadow-neutral-200">
          <span className="scale-125 text-blue-400">{icon}</span>
        </div>
        <h3 className="font-black text-neutral-900 mb-4 tracking-tighter text-xl group-hover:translateZ(10px) transition-transform">{title}</h3>
        <p className="text-sm text-neutral-400 font-medium leading-relaxed group-hover:text-neutral-600 transition-colors uppercase tracking-widest text-[10px] group-hover:translateZ(5px) transition-transform">{desc}</p>
      </div>
    </div>
  );
}
