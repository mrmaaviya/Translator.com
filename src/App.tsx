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
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  translateText, 
  translateFile, 
  generateGovResponse,
  LANGUAGES, 
  SupportedLanguage 
} from "./services/geminiService";

type AppTab = "text" | "image" | "pdf" | "gov";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("text");
  const [govMode, setGovMode] = useState<"reply" | "noting">("reply");
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUseFeature = (tab: AppTab) => {
    if (tab === "gov") return isPro;
    return true;
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
    } catch (error) {
      console.error(error);
      setOutputText("Error during translation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      let result = "";
      if (activeTab === "gov") {
        result = await generateGovResponse(base64, selectedFile.type, govMode, targetLang, fileInstruction);
      } else {
        result = await translateFile(base64, selectedFile.type, targetLang, fileInstruction);
      }
      setOutputText(result);
    } catch (error) {
      console.error(error);
      setOutputText("Error processing file. Please try again.");
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

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-100/50">
      {/* Header */}
      <header className="glass border-b border-neutral-200 sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center transform hover:rotate-6 transition-transform">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-neutral-900 flex items-baseline">
              Translator<span className="text-blue-600">.com</span>
            </h1>
          </div>
          <div className="flex items-center gap-8">
            <nav className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
              <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
              <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
              <a href="#contact" className="hover:text-blue-600 transition-colors">Support</a>
            </nav>
            <div className="h-10 w-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-500 shadow-inner overflow-hidden">
              <span className="opacity-0 group-hover:opacity-100 absolute -top-12 bg-black text-white px-3 py-1 rounded text-[10px]">Your Profile</span>
              M
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-100 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2 opacity-50" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-600 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            Empowering the Asian Language Bridge
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.95]"
          >
            Translate text, letters <br /> <span className="text-neutral-300">and institutional data.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-neutral-500 font-medium max-w-2xl mx-auto mb-12"
          >
            The world's first AI translator designed for official Hindi, Urdu, and English 
            documentation. From casual chats to complex sanchikas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-300">Explore Platform</span>
            <ChevronDown className="w-5 h-5 text-neutral-200 animate-bounce" />
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
        </div>

        {/* Translation Container */}
        <motion.div 
          layout
          className="bg-white rounded-[3rem] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.08)] border border-neutral-100 overflow-hidden min-h-[580px] flex flex-col relative"
        >
          {/* Subtle brand accent */}
          <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-500 ${activeTab === 'gov' ? 'bg-orange-500' : 'bg-blue-600'}`} />
          
          {/* Language Selector Bar */}
          <div className="flex items-center justify-center py-6 px-10 border-b border-neutral-50 bg-neutral-50/30">
            <div className="flex items-center gap-4 md:gap-16 w-full max-w-5xl justify-between">
              {activeTab === "gov" ? (
                <div className="flex items-center gap-8 w-full">
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-sm">
                    <button 
                      onClick={() => setGovMode("reply")}
                      className={`px-8 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${govMode === "reply" ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"}`}
                    >
                      Official Draft
                    </button>
                    <button 
                      onClick={() => setGovMode("noting")}
                      className={`px-8 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${govMode === "noting" ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"}`}
                    >
                      Noting Sheet
                    </button>
                  </div>
                  <div className="hidden lg:block flex-1 text-center font-black text-neutral-300 text-[10px] uppercase tracking-[0.4em]">Administrative Authority Mode</div>
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
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept={activeTab === "image" ? "image/*" : ".pdf"}
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
                              <div className="relative group/preview">
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
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute bottom-6 left-8 flex items-center gap-6 text-neutral-300">
                <button className="hover:text-blue-600 transition-colors"><Mic className="w-5 h-5" /></button>
                <button 
                  onClick={() => speak(inputText, sourceLang === "Detect Language" ? "English" : sourceLang)}
                  className="hover:text-blue-600 transition-colors"
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
            <div className={`relative p-8 bg-neutral-50/30 transition-all duration-500 ${targetLang === "Urdu" ? "text-right" : "text-left"}`} dir={targetLang === "Urdu" ? "rtl" : "ltr"}>
              {isLoading ? (
                <div className="h-full min-h-[350px] flex flex-col items-center justify-center gap-6 text-neutral-400">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-100 blur-2xl opacity-50 animate-pulse"></div>
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 relative z-10" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-600">Artificial Intelligence</p>
                    <p className="text-[10px] uppercase tracking-[0.2em]">{activeTab === 'gov' ? 'Analyzing official hierarchy...' : 'Processing language vectors...'}</p>
                  </div>
                </div>
              ) : (
                <div className={`h-full min-h-[350px] text-3xl font-medium whitespace-pre-wrap ${targetLang === "Urdu" ? "font-urdu" : "leading-tight"} ${!outputText && 'text-neutral-200 italic text-2xl font-light'}`}>
                  {outputText || (targetLang === "Urdu" ? "نتائج یہاں ظاہر ہوں گے..." : "Result will appear here...")}
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
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black italic text-white">₹499</span>
                  <span className="text-neutral-500 font-bold text-sm uppercase">/ Month</span>
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
                  Unlock Pro Power
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
                    <p className="text-xl font-black">₹499 <span className="text-xs font-bold text-neutral-400">/ month</span></p>
                  </div>
                  <button 
                    onClick={() => { setIsPro(true); setShowPricing(false); }}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform"
                  >
                    Unlock Pro
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

      {/* Footer */}
      <footer className="mt-40 border-t border-neutral-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="max-w-sm space-y-4">
              <h2 className="text-2xl font-black italic tracking-tighter">Translator<span className="text-blue-600">.com</span></h2>
              <p className="text-sm text-neutral-400 font-medium leading-relaxed uppercase tracking-wider">The most accurate bridge between English, Hindi, and Urdu populations. Focused on administrative efficiency.</p>
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
    <div className="group p-8 rounded-[2.5rem] bg-white border border-neutral-50 shadow-sm hover:shadow-2xl hover:shadow-blue-100/30 transition-all duration-500 hover:translate-y-[-10px]">
      <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center mb-6 border border-neutral-100 group-hover:rotate-6 transition-all duration-500">
        <span className="scale-125">{icon}</span>
      </div>
      <h3 className="font-bold text-neutral-800 mb-3 tracking-tight group-hover:text-blue-600 transition-colors uppercase text-[10px] tracking-widest pl-1 border-l-2 border-neutral-100 group-hover:border-blue-600">{title}</h3>
      <p className="text-xs text-neutral-400 font-medium leading-relaxed group-hover:text-neutral-600 transition-colors">{desc}</p>
    </div>
  );
}
