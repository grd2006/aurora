// pages/my-post.js
import MarkdownRenderer from '../components/MarkdownRenderer';

function MyPostPage() {
  const myMarkdown = `
# My Markdown Title

This is a paragraph with some **bold** and *italic* text.

- List item 1
- List item 2

[Visit Google](https://google.com)
  `;

  return (
    <div>
      <MarkdownRenderer markdownContent={myMarkdown} />
    </div>
  );
}

export default MyPostPage;