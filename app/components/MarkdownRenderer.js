// components/MarkdownRenderer.js
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // Optional: for GitHub Flavored Markdown

function MarkdownRenderer({ markdownContent }) {
  return (
    <article className="prose lg:prose-xl prose-slate dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {markdownContent}
      </ReactMarkdown>
    </article>
  );
}

export default MarkdownRenderer;