import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, Globe } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link 
        to="/"
        className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors mb-8 group font-medium"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Pin Creator
      </Link>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8 md:p-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-50 p-3 rounded-2xl">
            <ShieldCheck className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
        </div>

        <p className="text-slate-500 mb-10 pb-6 border-b border-slate-100">
          Last updated: May 2024. This Privacy Policy describes how PinGenius AI ("we", "us", or "our") handles your information when you use our Pinterest Pin Creator tool.
        </p>

        <div className="space-y-10 text-slate-700 leading-relaxed">
          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-900 font-bold uppercase tracking-wider text-xs">
              <Eye className="w-4 h-4 text-red-500" />
              1. Information Handling
            </div>
            <p>
              We prioritize your privacy. We collect the keywords and text you input into the application solely to generate content. 
              <strong> We do not collect or store any personal identification information</strong> (such as your name, email, or Pinterest credentials) on our own servers.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-900 font-bold uppercase tracking-wider text-xs">
              <Globe className="w-4 h-4 text-red-500" />
              2. AI and Third-Party Services
            </div>
            <p>
              Our application utilizes the <strong>Google Gemini API</strong> to generate headlines, SEO metadata, and AI-powered background images. 
              By using PinGenius AI, you acknowledge that your text inputs are processed by Google's infrastructure to facilitate content generation. 
              We recommend avoiding the input of sensitive personal data into keyword prompts.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-900 font-bold uppercase tracking-wider text-xs">
              <Database className="w-4 h-4 text-red-500" />
              3. Data Storage
            </div>
            <p>
              PinGenius AI is a client-side application. Generated images and metadata are stored in your browser's temporary memory. 
              Once you close your browser tab or clear your cache, your session data is typically purged. 
              We do not maintain a persistent database of your generated designs.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-slate-900 font-bold uppercase tracking-wider text-xs">
              <Lock className="w-4 h-4 text-red-500" />
              4. Pinterest Compliance
            </div>
            <p>
              This application is an independent tool for content creation. While we help you design for Pinterest, 
              we do not have access to your Pinterest account. You are solely responsible for the content you 
              choose to download and subsequently upload to the Pinterest platform.
            </p>
          </section>

          <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-2">Policy Inquiries</h3>
            <p className="text-sm text-slate-600">
              For any questions regarding your data or our integration with AI services, please contact us at: 
              <span className="text-red-600 ml-1 font-medium">support@pingenius-ai.example.com</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};