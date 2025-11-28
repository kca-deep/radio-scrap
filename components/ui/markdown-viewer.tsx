'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  if (!content) {
    return (
      <div className="text-muted-foreground text-sm italic">
        내용 없음
      </div>
    );
  }

  return (
    <div className={cn('markdown-viewer', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3 pb-1 border-b">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-2">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold mt-2 mb-1">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-medium mt-2 mb-1 text-muted-foreground">
              {children}
            </h6>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="my-3 leading-7">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="my-3 ml-6 list-disc space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-6 list-decimal space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-7">
              {children}
            </li>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {children}
            </a>
          ),

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),

          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="relative rounded bg-muted px-[0.4rem] py-[0.2rem] font-mono text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={cn('font-mono text-sm', className)}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
              {children}
            </pre>
          ),

          // Table
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b last:border-b-0">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2">
              {children}
            </td>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="my-6 border-t" />
          ),

          // Strong & Emphasis
          strong: ({ children }) => (
            <strong className="font-semibold">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">
              {children}
            </em>
          ),

          // Images
          img: ({ src, alt }) => (
            <span className="block my-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt || ''}
                className="max-w-full h-auto rounded-lg border"
                loading="lazy"
              />
              {alt && (
                <span className="block text-center text-sm text-muted-foreground mt-2">
                  {alt}
                </span>
              )}
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
