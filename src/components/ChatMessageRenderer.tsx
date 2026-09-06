import React, { createContext, useContext, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import { Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Context to distinguish code blocks from inline code
const PreContext = createContext<boolean>(false);

interface CodeBlockProps {
  language?: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Determine highlighted HTML
  let highlightedHtml = '';
  const lang = language?.toLowerCase().trim() || '';

  try {
    if (lang && hljs.getLanguage(lang)) {
      highlightedHtml = hljs.highlight(value, { language: lang, ignoreIllegals: true }).value;
    } else {
      highlightedHtml = hljs.highlightAuto(value).value;
    }
  } catch {
    highlightedHtml = '';
  }

  const displayLanguage = lang || 'code';

  return (
    <div className="w-full min-w-0 my-3 overflow-hidden rounded-xl border border-slate-700/60 dark:border-main-border shadow-xs bg-[#0e1726] dark:bg-[#0b1220]">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50 dark:border-main-border/50 bg-[#131d2e] dark:bg-[#0f172a] text-slate-300 dark:text-muted-text">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-muted-text">
          {displayLanguage}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 dark:text-muted-text hover:text-white dark:hover:text-brand hover:bg-slate-700/50 dark:hover:bg-brand/10 transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content Container */}
      <div className="overflow-x-auto p-4 text-xs md:text-[13px] font-mono leading-relaxed text-slate-100">
        {highlightedHtml ? (
          <pre className="!m-0 !p-0 !bg-transparent !border-0">
            <code
              className="hljs !bg-transparent !p-0 !font-mono"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </pre>
        ) : (
          <pre className="!m-0 !p-0 !bg-transparent !border-0">
            <code className="!bg-transparent !p-0 !font-mono">{value}</code>
          </pre>
        )}
      </div>
    </div>
  );
};

interface ChatMessageRendererProps {
  content: string;
  msgId?: string;
}

export const ChatMessageRenderer: React.FC<ChatMessageRendererProps> = ({ content, msgId }) => {
  const { t } = useTranslation();

  // Handle special welcome token or known welcome message IDs
  let rawText = content;
  const isWelcomeMessage =
    rawText === 'SPECIAL_TOKEN_WELCOME' ||
    (msgId && (msgId === 'msg-welcome-init' || msgId.startsWith('msg-welcome-'))) ||
    rawText.includes("MindStream AI Assistant") ||
    rawText.includes("assistant IA MindStream") ||
    rawText.includes("Asisten AI MindStream") ||
    rawText.includes("Asistente de IA MindStream") ||
    rawText.includes("مساعد الذكاء الاصطناعي");

  if (isWelcomeMessage) {
    rawText = t('aiAssistantWelcome');
  }

  if (!rawText) return null;

  return (
    <div className="chat-markdown w-full min-w-0 break-words leading-relaxed text-xs md:text-sm text-main-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Pre wrapper provides context to differentiate fenced blocks from inline code
          pre({ children }) {
            return (
              <PreContext.Provider value={true}>
                {children}
              </PreContext.Provider>
            );
          },

          // Code elements (either block or inline)
          code({ className, children, ...props }) {
            const isInsidePre = useContext(PreContext);
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (isInsidePre) {
              return <CodeBlock language={match ? match[1] : ''} value={codeString} />;
            }

            return (
              <code
                className="bg-brand/10 dark:bg-brand/20 text-brand px-1.5 py-0.5 rounded font-mono text-[0.88em] font-medium border border-brand/15 inline-block"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Headings
          h1({ children }) {
            return <h1 className="text-base md:text-lg font-extrabold text-main-text mt-4 mb-2 first:mt-0">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm md:text-base font-bold text-main-text mt-3.5 mb-1.5 first:mt-0">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs md:text-sm font-bold text-main-text mt-3 mb-1 first:mt-0">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-xs md:text-sm font-semibold text-main-text mt-2.5 mb-1 first:mt-0">{children}</h4>;
          },
          h5({ children }) {
            return <h5 className="text-xs md:text-sm font-semibold text-main-text mt-2 mb-1 first:mt-0">{children}</h5>;
          },
          h6({ children }) {
            return <h6 className="text-xs font-semibold text-secondary-text mt-2 mb-1 first:mt-0 uppercase tracking-wider">{children}</h6>;
          },

          // Paragraphs
          p({ children }) {
            return <p className="my-2 first:mt-0 last:mb-0 leading-relaxed text-main-text min-h-[1.25rem]">{children}</p>;
          },

          // Lists
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1 text-main-text">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1 text-main-text">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed pl-1 text-main-text">{children}</li>;
          },

          // Blockquotes
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-brand/60 pl-3.5 py-1.5 my-2.5 italic text-secondary-text bg-brand/5 dark:bg-brand/10 rounded-r-xl">
                {children}
              </blockquote>
            );
          },

          // Links
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline font-semibold underline-offset-2 break-all transition-colors"
              >
                {children}
              </a>
            );
          },

          // Strong & Em
          strong({ children }) {
            return <strong className="font-extrabold text-main-text">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-main-text">{children}</em>;
          },

          // Horizontal Rule
          hr() {
            return <hr className="my-4 border-main-border" />;
          },

          // Tables
          table({ children }) {
            return (
              <div className="w-full overflow-x-auto my-3 rounded-xl border border-main-border shadow-xs">
                <table className="min-w-full divide-y divide-main-border text-xs md:text-sm text-left">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-brand/10 dark:bg-brand/15 text-main-text font-bold">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-main-border bg-card-bg/40">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-brand/5 transition-colors">{children}</tr>;
          },
          th({ children }) {
            return (
              <th className="px-3.5 py-2.5 text-xs font-bold text-main-text border-b border-main-border">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3.5 py-2 text-xs md:text-sm text-main-text border-b border-main-border/60">
                {children}
              </td>
            );
          },
        }}
      >
        {rawText}
      </ReactMarkdown>
    </div>
  );
};

export default ChatMessageRenderer;
