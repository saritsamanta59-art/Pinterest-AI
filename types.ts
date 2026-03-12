export interface PinterestAccount {
  accessToken: string;
  username: string;
  profileImage?: string;
  boards?: PinterestBoard[];
}

export interface PinterestBoard {
  id: string;
  name: string;
}

export interface PinVariation {
  headline: string;
  seoTitle: string;
  seoDescription: string;
  hashtags: string;
  textColor: string;
  outlineColor: string;
  imagePrompt: string;
  ctaText: string;
  imageUrl?: string | null;
  fallbackMode?: boolean;
  targetBoardId?: string;
  destinationUrl?: string;
}

export interface PinConfig {
  headline: string;
  ctaText: string;
  showCta: boolean;
  brandText: string;
  fontFamily: string;
  textColor: string;
  outlineColor: string;
  brandColor: string;
  ctaBgColor: string;
  ctaTextColor: string;
  textYPos: number;
  colorScheme: 'standard' | 'monochrome' | 'dark-overlay';
}

export interface FontOption {
  name: string;
  value: string;
}

export const FONTS: FontOption[] = [
  { name: 'Bold Sans', value: '"Arial Black", "Helvetica Neue", sans-serif' }, 
  { name: 'Sans Serif', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { name: 'Monospace', value: '"Courier New", Courier, monospace' },
  { name: 'Cursive', value: '"Brush Script MT", cursive' },
  { name: 'Modern', value: 'Verdana, Geneva, sans-serif' },
];