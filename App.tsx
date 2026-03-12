import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Shield, User as UserIcon, LogOut, Settings, ChevronDown, Loader2 } from 'lucide-react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { ControlPanel } from './components/ControlPanel';
import { CanvasPreview, CanvasPreviewHandle } from './components/CanvasPreview';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Auth } from './components/Auth';
import { Profile } from './components/Profile';
import { useAuth } from './components/AuthContext';
import { generatePinVariations, generatePinImage } from './services/geminiService';
import { PinVariation, PinConfig, FONTS, PinterestAccount } from './types';
import { fetchPinterestBoards } from './services/pinterestService';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-red-600" />
    </div>
  );
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
};

export default function App() {
  const { user, logout, loading: authLoading, getIdToken, updateProfile } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const canvasPreviewRef = useRef<CanvasPreviewHandle>(null);
  const navigate = useNavigate();

  // Data State
  const [keyword, setKeyword] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [variations, setVariations] = useState<PinVariation[]>([]);
  const [currentVarIndex, setCurrentVarIndex] = useState(0);
  
  // Pinterest State
  const [accounts, setAccounts] = useState<PinterestAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // Default to 1 hour from now
    d.setMinutes(d.getMinutes() - (d.getMinutes() % 5), 0, 0); // Round to nearest 5 mins
    return d.toISOString().slice(0, 16);
  });

  // Load accounts from user object
  useEffect(() => {
    if (user?.pinterestAccounts) {
      const userAccounts = user.pinterestAccounts;
      setAccounts(userAccounts);
      
      // If we have accounts but none selected, select the first one
      if (userAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(userAccounts[0].username);
        if (userAccounts[0].boards?.length > 0) {
          setSelectedBoardId(userAccounts[0].boards[0].id);
        }
      } 
      // If the selected account was removed, select the first available one or null
      else if (selectedAccountId && !userAccounts.find(a => a.username === selectedAccountId)) {
        if (userAccounts.length > 0) {
          setSelectedAccountId(userAccounts[0].username);
          setSelectedBoardId(userAccounts[0].boards?.[0]?.id || null);
        } else {
          setSelectedAccountId(null);
          setSelectedBoardId(null);
        }
      }
    } else {
      setAccounts([]);
      setSelectedAccountId(null);
      setSelectedBoardId(null);
    }
  }, [user, selectedAccountId]);

  // Configuration State
  const [config, setConfig] = useState<PinConfig>({
    headline: 'Your Catchy Headline Here',
    ctaText: 'Check it out',
    showCta: true,
    brandText: '',
    fontFamily: FONTS[0].value,
    textColor: '#000000',
    outlineColor: '#ffffff',
    brandColor: '#ffffff',
    ctaBgColor: '#e60023',
    ctaTextColor: '#ffffff',
    textYPos: 45,
    colorScheme: 'standard'
  });

  const handleGenerate = async () => {
    if (!keyword.trim()) return;
    setIsGeneratingText(true);
    setErrorMsg('');
    setVariations([]);
    setLoadingImages({});

    try {
      const data = await generatePinVariations(keyword, user?.geminiApiKey);
      if (data.variations && data.variations.length > 0) {
        const newVariations: PinVariation[] = data.variations.map(v => ({
          ...v,
          imageUrl: null,
          fallbackMode: false
        }));
        setVariations(newVariations);
        setCurrentVarIndex(0);
        const firstVar = newVariations[0];
        setConfig(prev => ({
          ...prev,
          headline: firstVar.headline,
          ctaText: firstVar.ctaText,
          showCta: true
        }));
      } else {
        throw new Error("No variations generated.");
      }
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to generate content.");
    } finally {
      setIsGeneratingText(false);
    }
  };

  const handleUpdateVariation = (index: number, updates: Partial<PinVariation>) => {
    setVariations(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], ...updates };
      }
      return updated;
    });
  };

  const handleUpdateSEO = (newSeo: { title: string, description: string, hashtags: string }) => {
    handleUpdateVariation(currentVarIndex, {
      seoTitle: newSeo.title,
      seoDescription: newSeo.description,
      hashtags: newSeo.hashtags
    });
  };

  const handleSelectVariation = (index: number) => {
    setCurrentVarIndex(index);
    const selectedVar = variations[index];
    if (selectedVar) {
      setConfig(prev => ({
        ...prev,
        headline: selectedVar.headline,
        ctaText: selectedVar.ctaText
      }));
    }
  };

  const handleConnectPinterest = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/auth/pinterest/url');
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      const { url } = data;
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      
      window.open(url, 'pinterest_oauth', `width=${width},height=${height},left=${left},top=${top}`);
    } catch (error) {
      console.error('Failed to get Pinterest auth URL', error);
      setErrorMsg('Failed to connect to Pinterest.');
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const authChannel = new BroadcastChannel('pinterest_auth');

    const handleAuthSuccess = async (data: PinterestAccount) => {
      const userData = data;
      
      // Fetch boards for the new account
      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Not authenticated");

        const boards = await fetchPinterestBoards(userData.accessToken, idToken);
        const newAccount = { ...userData, boards };
        
        // Save to Firestore via updateProfile
        const currentAccounts = user?.pinterestAccounts || [];
        const existsIdx = currentAccounts.findIndex((a: any) => a.username === newAccount.username);
        let updatedAccounts;
        if (existsIdx >= 0) {
          updatedAccounts = [...currentAccounts];
          updatedAccounts[existsIdx] = newAccount;
        } else {
          updatedAccounts = [...currentAccounts, newAccount];
        }

        await updateProfile({ pinterestAccounts: updatedAccounts });

        setAccounts(updatedAccounts);
        
        if (!selectedAccountId) {
          setSelectedAccountId(newAccount.username);
          if (boards.length > 0) setSelectedBoardId(boards[0].id);
        }
      } catch (e) {
        console.error('Failed to fetch boards or save account', e);
        setErrorMsg('Failed to sync Pinterest account.');
      }
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'PINTEREST_AUTH_SUCCESS') {
        handleAuthSuccess(event.data.data);
      } else if (event.data?.type === 'PINTEREST_AUTH_ERROR') {
        setErrorMsg('Pinterest authentication failed.');
      }
    };

    // Listen to BroadcastChannel as well
    authChannel.onmessage = (event) => {
      if (event.data?.type === 'PINTEREST_AUTH_SUCCESS') {
        handleAuthSuccess(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      authChannel.close();
    };
  }, [selectedAccountId]);

  useEffect(() => {
    const generateImagesInBackground = async () => {
      if (isGeneratingText || variations.length === 0) return;

      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        if (!v.imageUrl && !v.fallbackMode && !loadingImages[i]) {
          setLoadingImages(prev => ({ ...prev, [i]: true }));
          try {
            const base64Image = await generatePinImage(v.imagePrompt, user?.geminiApiKey);
            setVariations(prev => {
              const newVars = [...prev];
              if (newVars[i]) {
                newVars[i] = { ...newVars[i], imageUrl: base64Image };
              }
              return newVars;
            });
          } catch (e) {
            setVariations(prev => {
              const newVars = [...prev];
              if (newVars[i]) {
                newVars[i] = { ...newVars[i], fallbackMode: true };
              }
              return newVars;
            });
          } finally {
            setLoadingImages(prev => ({ ...prev, [i]: false }));
          }
          // Break after one generation to allow React to update and avoid blocking
          // The next effect run will pick up the next missing image
          break;
        }
      }
    };
    generateImagesInBackground();
  }, [variations, loadingImages, isGeneratingText]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  const handlePublishSingle = async (index: number, schedule: boolean = false, customDate?: string) => {
    const variation = variations[index];
    if (!selectedAccountId || !variation || isPublishing) return;
    
    const account = accounts.find(a => a.username === selectedAccountId);
    if (!account) return;

    const boardId = variation.targetBoardId || selectedBoardId;
    if (!boardId) {
      setPublishStatus(`Error: No board selected for Pin #${index + 1}`);
      return;
    }

    if (!variation.imageUrl && !variation.fallbackMode) {
      setPublishStatus(`Error: Image still generating for Pin #${index + 1}`);
      return;
    }

    setIsPublishing(true);
    setPublishStatus(schedule ? `Scheduling Pin #${index + 1}...` : `Publishing Pin #${index + 1}...`);

    try {
      console.log("Pinterest Fix v3 (JPEG/Aggressive) Active");
      const { renderPinToDataUrl } = await import('./services/renderService');
      const dataUrl = await renderPinToDataUrl(variation, config);
      const base64Part = dataUrl.split(',').pop() || '';
      // Aggressively remove ANY character that isn't valid base64
      const imageData = base64Part.replace(/[^a-zA-Z0-9+/=]/g, '');
      
      if (!imageData || imageData.length < 10) {
        throw new Error("Failed to generate valid image data. Please try again.");
      }

      const slugify = (text: string) => {
        return text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };

      const finalUrl = variation.destinationUrl || (baseUrl 
        ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${slugify(variation.seoTitle)}`
        : baseUrl);

      const pinData: any = {
        title: variation.seoTitle,
        description: variation.seoDescription,
        boardId: boardId,
        link: finalUrl,
        imageData: imageData,
      };

      if (schedule) {
        const dateToUse = customDate ? new Date(customDate) : new Date(Date.now() + 15 * 60 * 1000);
        pinData.publishAt = dateToUse.toISOString(); 
      }

      const { createPinterestPin } = await import('./services/pinterestService');
      const idToken = await getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      await createPinterestPin(pinData, account.accessToken, idToken);

      setPublishStatus(schedule ? `Successfully scheduled Pin #${index + 1}!` : `Successfully published Pin #${index + 1}!`);
      setTimeout(() => setPublishStatus(null), 5000);
    } catch (error: any) {
      console.error('Publishing Error:', error);
      let msg = error.message;
      if (msg.toLowerCase().includes('business') || msg.toLowerCase().includes('permission')) {
        msg += " (Note: Pinterest scheduling requires a Business Account)";
      }
      setPublishStatus(`Error: ${msg}`);
    } finally {
      setIsPublishing(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-red-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-red-100 selection:text-red-600 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="bg-red-600 p-2 rounded-full shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">PinGenius AI</h1>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all"
                >
                  <span className="text-xs font-bold text-slate-700">{user.name}</span>
                  <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 border-b border-slate-100 mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signed in as</p>
                      <p className="text-xs font-bold text-slate-700 truncate">{user.email}</p>
                    </div>
                    <Link 
                      to="/profile" 
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Account Settings
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                to="/auth" 
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all"
              >
                Sign In
              </Link>
            )}
            <div className="hidden md:flex items-center gap-4">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">PRO</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <Routes>
          <Route path="/privacypolicy" element={<PrivacyPolicy />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile 
                onConnectPinterest={handleConnectPinterest}
                isConnectingPinterest={isConnecting}
              />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <main className="flex-1 max-w-7xl mx-auto p-4 lg:p-8 w-full flex flex-col lg:flex-row gap-8 min-h-0">
                <div className="w-full lg:w-1/3 lg:h-[calc(100vh-10rem)] lg:overflow-y-auto flex flex-col order-2 lg:order-1 custom-scrollbar pr-2">
                  <ControlPanel 
                    keyword={keyword}
                    setKeyword={setKeyword}
                    baseUrl={baseUrl}
                    setBaseUrl={setBaseUrl}
                    onGenerate={handleGenerate}
                    onUpdateSEO={handleUpdateSEO}
                    onUpdateVariation={handleUpdateVariation}
                    isGenerating={isGeneratingText}
                    variations={variations}
                    currentVarIndex={currentVarIndex}
                    onSelectVariation={handleSelectVariation}
                    config={config}
                    setConfig={setConfig}
                    loadingImages={loadingImages}
                    errorMsg={errorMsg}
                    accounts={accounts}
                    selectedAccountId={selectedAccountId}
                    setSelectedAccountId={setSelectedAccountId}
                    selectedBoardId={selectedBoardId}
                    setSelectedBoardId={setSelectedBoardId}
                    onConnect={handleConnectPinterest}
                    isConnecting={isConnecting}
                    canvasRef={canvasPreviewRef}
                    userApiKey={user?.geminiApiKey}
                    isPublishing={isPublishing}
                    publishStatus={publishStatus}
                    onPublishSingle={handlePublishSingle}
                    scheduleDate={scheduleDate}
                    setScheduleDate={setScheduleDate}
                  />
                </div>
                <div className="w-full lg:w-2/3 order-1 lg:order-2 flex flex-col items-center justify-start lg:pt-4">
                  <CanvasPreview 
                    ref={canvasPreviewRef}
                    variation={variations[currentVarIndex] || null}
                    config={config}
                    imageUrl={variations[currentVarIndex]?.imageUrl}
                    isLoadingImage={loadingImages[currentVarIndex]}
                    isGeneratingText={isGeneratingText}
                    onSchedule={() => handlePublishSingle(currentVarIndex, true, scheduleDate)}
                    isPublishing={isPublishing}
                  />
                </div>
              </main>
            </ProtectedRoute>
          } />
        </Routes>
      </div>

      <footer className="bg-white border-t border-slate-200 py-6 shrink-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Sparkles className="w-4 h-4 text-red-600" />
              <span>PinGenius AI</span>
            </div>
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} AI-powered design for Pinterest creators.</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4">
            <Link to="/privacypolicy" className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Privacy Policy
            </Link>
            <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">Google Gemini</a>
            <span className="hidden md:inline text-slate-200">|</span>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Pinterest Authorized</p>
          </div>
        </div>
      </footer>
    </div>
  );
}