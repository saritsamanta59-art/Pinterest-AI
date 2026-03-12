import React, { useState } from 'react';
import { 
  Palette, 
  Layout, 
  Droplet, 
  Layers, 
  Check, 
  Copy, 
  MousePointerClick,
  Loader2,
  Sparkles,
  Zap,
  Wand2,
  Eye,
  EyeOff,
  Type as FontIcon,
  Tag,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Calendar,
  Send,
  User
} from 'lucide-react';
import { PinConfig, PinVariation, FONTS, PinterestAccount } from '../types';
import { rephraseCTA, generateSEOMetadata } from '../services/geminiService';

interface ControlPanelProps {
  keyword: string;
  setKeyword: (k: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  onGenerate: () => void;
  onUpdateSEO: (seo: { title: string, description: string, hashtags: string }) => void;
  onUpdateVariation: (idx: number, updates: Partial<PinVariation>) => void;
  isGenerating: boolean;
  variations: PinVariation[];
  currentVarIndex: number;
  onSelectVariation: (idx: number) => void;
  config: PinConfig;
  setConfig: (c: PinConfig) => void;
  loadingImages: Record<number, boolean>;
  errorMsg: string;
  accounts: PinterestAccount[];
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  selectedBoardId: string | null;
  setSelectedBoardId: (id: string | null) => void;
  onConnect: () => void;
  isConnecting: boolean;
  canvasRef: React.RefObject<any>;
  userApiKey?: string;
  isPublishing: boolean;
  publishStatus: string | null;
  onPublishSingle: (idx: number, schedule?: boolean, customDate?: string) => void;
  scheduleDate: string;
  setScheduleDate: (d: string) => void;
  isSandbox?: boolean;
}

const COLOR_SCHEMES = [
  { id: 'standard', name: 'Standard', icon: Palette },
  { id: 'monochrome', name: 'Monochrome', icon: Droplet },
  { id: 'dark-overlay', name: 'Dark Overlay', icon: Layers },
];

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  keyword,
  setKeyword,
  baseUrl,
  setBaseUrl,
  onGenerate,
  onUpdateSEO,
  onUpdateVariation,
  isGenerating,
  variations,
  currentVarIndex,
  onSelectVariation,
  config,
  setConfig,
  loadingImages,
  errorMsg,
  accounts,
  selectedAccountId,
  setSelectedAccountId,
  selectedBoardId,
  setSelectedBoardId,
  onConnect,
  isConnecting,
  canvasRef,
  userApiKey,
  isPublishing,
  publishStatus,
  onPublishSingle,
  scheduleDate,
  setScheduleDate,
  isSandbox
}) => {
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isRephrasing, setIsRephrasing] = useState(false);
  const [isEnhancingSEO, setIsEnhancingSEO] = useState(false);
  const [ctaSuggestions, setCtaSuggestions] = useState<string[]>([]);

  const currentVariation = variations[currentVarIndex];
  const smartUrl = currentVariation && baseUrl 
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${slugify(currentVariation.seoTitle)}`
    : baseUrl;

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  const updateConfig = (key: keyof PinConfig, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  const handleMagicRephrase = async () => {
    if (!config.headline || isRephrasing) return;
    setIsRephrasing(true);
    try {
      const suggestions = await rephraseCTA(config.headline, userApiKey);
      setCtaSuggestions(suggestions);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRephrasing(false);
    }
  };

  const handleMagicSEO = async () => {
    if (!config.headline || isEnhancingSEO) return;
    setIsEnhancingSEO(true);
    try {
      const seo = await generateSEOMetadata(config.headline, keyword, userApiKey);
      onUpdateSEO(seo);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnhancingSEO(false);
    }
  };

  const selectedAccount = accounts.find(a => a.username === selectedAccountId);

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Pinterest Connection Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Send className="w-4 h-4 text-red-600" /> Pinterest Accounts
            {isSandbox && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-tighter border border-amber-200">
                Sandbox
              </span>
            )}
          </label>
          <button 
            onClick={onConnect}
            disabled={isConnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all"
          >
            {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Connect
          </button>
        </div>

        {accounts.length > 0 ? (
          <div className="space-y-4">
            {isSandbox && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Sandbox Mode Active
                </p>
                <p className="text-[9px] text-amber-700 leading-relaxed">
                  Ensure your Pinterest account is added as a <strong>Sandbox User</strong> in the <a href="https://developers.pinterest.com/apps/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Developer Portal</a>. Regular accounts will return 403 Forbidden errors in sandbox mode.
                </p>
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {accounts.map(acc => (
                <button
                  key={acc.username}
                  onClick={() => setSelectedAccountId(acc.username)}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-all shrink-0 ${selectedAccountId === acc.username ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-red-300'}`}
                >
                  {acc.profileImage ? (
                    <img src={acc.profileImage} alt={acc.username} className="w-6 h-6 rounded-full" />
                  ) : (
                    <User className="w-6 h-6 p-1 bg-slate-100 rounded-full" />
                  )}
                  <span className="text-xs font-bold">{acc.username}</span>
                </button>
              ))}
            </div>

            {selectedAccount && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Target Board</label>
                  <select 
                    value={selectedBoardId || ''} 
                    onChange={(e) => setSelectedBoardId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-red-500 outline-none bg-white"
                  >
                    <option value="" disabled>Select a board</option>
                    {selectedAccount.boards?.map(board => (
                      <option key={board.id} value={board.id}>{board.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Custom Schedule Date (Optional)
                  </label>
                  <input 
                    type="datetime-local" 
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-red-500 outline-none bg-white"
                  />
                  <p className="text-[9px] text-slate-400 italic">Used for both "Publish 5" and single pin scheduling.</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => onPublishSingle(currentVarIndex, true, scheduleDate)}
                    disabled={!selectedBoardId || !currentVariation || isPublishing}
                    className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${!selectedBoardId || !currentVariation || isPublishing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'}`}
                  >
                    {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
                    Schedule Pin
                  </button>
                </div>
                
                {publishStatus && (
                  <p className={`text-[10px] font-bold text-center uppercase ${publishStatus.includes('Error') ? 'text-red-500' : 'text-emerald-500'}`}>
                    {publishStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">No accounts connected yet</p>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 shrink-0">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Pin Topic</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. Woodworking Plans"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
          />
          <button 
            onClick={onGenerate}
            disabled={isGenerating || !keyword.trim()}
            className={`px-6 py-3 rounded-xl font-semibold text-white transition-all flex items-center gap-2 ${
              isGenerating || !keyword.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-md'
            }`}
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Create
          </button>
        </div>
        {errorMsg && (
          <div className="mt-3 text-xs p-2 rounded-lg border text-amber-600 bg-amber-50 border-amber-100">
            {errorMsg}
          </div>
        )}
      </div>

      {variations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3 h-3" /> Variation
            </label>
            <div className="flex gap-1">
              {variations.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectVariation(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${currentVarIndex === idx ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-red-300'}`}
                >
                  {loadingImages[idx] ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-8">
            
            {/* Destination URL Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <LinkIcon className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Destination URL</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Base Link</label>
                  <input 
                    type="url" 
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://mysite.com/product"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-red-500 outline-none"
                  />
                </div>

                {baseUrl && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" /> Generated Smart URL
                      </label>
                      <button 
                        onClick={() => copyToClipboard(smartUrl, setCopiedUrl)}
                        className="text-slate-400 hover:text-red-600 transition-colors flex items-center gap-1"
                      >
                        {copiedUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="text-[10px] font-bold uppercase">{copiedUrl ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 break-all font-mono line-clamp-2 bg-white p-2 rounded border border-slate-100">
                      {smartUrl}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-100" />
            
            {/* Pinterest Metadata Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-red-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Pinterest SEO</h3>
                </div>
                <button 
                  onClick={handleMagicSEO}
                  disabled={isEnhancingSEO}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm border ${isEnhancingSEO ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white text-red-600 border-red-100 hover:bg-red-50 hover:scale-105 active:scale-95'}`}
                >
                  {isEnhancingSEO ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {isEnhancingSEO ? 'Optimizing...' : 'Magic Enhance'}
                </button>
              </div>

              {currentVariation && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Pin Title</label>
                        <button 
                          onClick={() => copyToClipboard(currentVariation.seoTitle, setCopiedTitle)} 
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Copy Title"
                        >
                          {copiedTitle ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">SEO OPTIMIZED</span>
                    </div>
                    <input 
                      type="text" 
                      value={currentVariation.seoTitle}
                      onChange={(e) => onUpdateSEO({ ...currentVariation, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-red-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Description (Inc. Hashtags)</label>
                      <button onClick={() => copyToClipboard(currentVariation.seoDescription, setCopiedDesc)} className="text-slate-400 hover:text-red-600 transition-colors" title="Copy Description & Tags">
                        {copiedDesc ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <textarea 
                      value={currentVariation.seoDescription}
                      onChange={(e) => onUpdateSEO({ ...currentVariation, description: e.target.value, title: currentVariation.seoTitle })}
                      className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:border-red-500 outline-none h-48 resize-none leading-relaxed font-normal"
                      placeholder="Enter description and hashtags..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100" />

            {/* CTA Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-red-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">CTA Button</h3>
                </div>
                <button 
                  onClick={() => updateConfig('showCta', !config.showCta)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${config.showCta ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                >
                  {config.showCta ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {config.showCta ? 'Visible' : 'Hidden'}
                </button>
              </div>

              {config.showCta && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={config.ctaText}
                      onChange={(e) => updateConfig('ctaText', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-red-500 outline-none"
                      placeholder="e.g. Shop Now"
                      maxLength={25}
                    />
                    <button 
                      onClick={handleMagicRephrase}
                      disabled={isRephrasing}
                      title="Magic Rephrase with AI"
                      className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      {isRephrasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {(ctaSuggestions.length > 0 || isRephrasing) && (
                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="w-full text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-amber-500 fill-current" /> AI Suggestions
                      </p>
                      {isRephrasing ? (
                        <div className="h-6 w-full animate-pulse bg-slate-200 rounded"></div>
                      ) : (
                        ctaSuggestions.map(s => (
                          <button
                            key={s}
                            onClick={() => updateConfig('ctaText', s)}
                            className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:border-red-300 hover:text-red-600 transition-all"
                          >
                            {s}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                       <label className="text-[10px] text-slate-400 font-bold uppercase">Bg</label>
                       <input type="color" value={config.ctaBgColor} onChange={(e) => updateConfig('ctaBgColor', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[10px] text-slate-400 font-bold uppercase">Text</label>
                       <input type="color" value={config.ctaTextColor} onChange={(e) => updateConfig('ctaTextColor', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <FontIcon className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Canvas Content</h3>
              </div>
              <textarea 
                value={config.headline}
                onChange={(e) => updateConfig('headline', e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:border-red-500 outline-none resize-none h-20"
              />
              <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Vertical Position</label>
                  <input type="range" min="10" max="90" value={config.textYPos} onChange={(e) => updateConfig('textYPos', Number(e.target.value))} className="w-full accent-red-600 h-2 bg-slate-100 rounded-lg appearance-none" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Palette className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Visual Style</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_SCHEMES.map(s => {
                  const Icon = s.icon;
                  return (
                    <button key={s.id} onClick={() => updateConfig('colorScheme', s.id)} className={`flex flex-col items-center p-2 rounded-lg border text-[10px] font-bold uppercase transition-all ${config.colorScheme === s.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 hover:border-slate-300'}`}>
                      <Icon className="w-4 h-4 mb-1" />{s.name}
                    </button>
                  );
                })}
              </div>
              <select value={config.fontFamily} onChange={(e) => updateConfig('fontFamily', e.target.value)} className="w-full p-2 rounded-lg border border-slate-200 text-sm bg-white outline-none">
                {FONTS.map(f => <option key={f.name} value={f.value}>{f.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};