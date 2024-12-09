import React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

const SEO = ({ title, description, image, article }) => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language;
  
  const defaults = {
    title: 'PromptPal - Your AI Prompt Management Companion',
    description: 'Organize, manage, and optimize your AI prompts with PromptPal. Boost your productivity with smart prompt management, real-time chat, and seamless AI integration.',
    image: 'https://promptpal.ai/og-image.png',
    url: 'https://promptpal.ai'
  };

  const seo = {
    title: title || defaults.title,
    description: description || defaults.description,
    image: image || defaults.image,
    url: defaults.url,
  };

  return (
    <Helmet>
      {/* Set language attribute */}
      <html lang={currentLanguage} />
      
      {/* Basic Meta Tags */}
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="image" content={seo.image} />

      {/* Open Graph Meta Tags */}
      <meta property="og:url" content={seo.url} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.image} />
      {article && <meta property="og:type" content="article" />}

      {/* Twitter Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />

      {/* Hreflang Tags for Language Versions */}
      <link rel="alternate" href={`${seo.url}/en`} hrefLang="en" />
      <link rel="alternate" href={`${seo.url}/zh`} hrefLang="zh" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={seo.url} />
    </Helmet>
  );
};

export default SEO;
