// @ts-nocheck - Disable TypeScript checking for this file due to markdown-to-jsx typing issues
import React from 'react';
import Markdown from 'markdown-to-jsx';
import CodeSnippet from '@/components/main/code/markdown/CodeSnippet';

// @ts-ignore - Ignoring type errors for markdown-to-jsx options
const markdownOptions = {
  overrides: {
    p: {
      // Use div instead of p to allow nesting block elements
      component: (props: any) => (
        <div style={{ margin: '0.5em 0' }}>
          {props.children}
        </div>
      )
    },
    pre: {
      component: (props: any) => (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            overflowX: 'hidden',
          }}
        >
          {props.children}
        </pre>
      )
    },
    code: {
      component: CodeSnippet
    },
    h1: {
      component: (props: any) => (
        <h1 style={{ marginTop: '1em' }} {...props} />
      )
    },
    h2: {
      component: (props: any) => (
        <h2 style={{ marginTop: '0.75em' }} {...props} />
      )
    },
    h3: {
      component: (props: any) => (
        <h3 style={{ marginTop: '0.75em' }} {...props} />
      )
    },
    strong: {
      component: (props: any) => (
        <strong style={{ fontWeight: 'bold' }}>
          {props.children}
        </strong>
      )
    },
  },
};

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // @ts-ignore - Ignoring type errors for markdown-to-jsx options
  return (
    <Markdown options={markdownOptions}>
      {content}
    </Markdown>
  );
};

export default MarkdownRenderer;
