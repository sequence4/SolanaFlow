// @ts-nocheck - Disable TypeScript checking for this file due to markdown-to-jsx typing issues
import React from 'react';
import Markdown from 'markdown-to-jsx';

// Transparent code component to replace CodeSnippet
const TransparentCode = ({ children, className }: any) => {
  const isBlock = className?.includes('language-') || (typeof children === 'string' && children.includes('\n'));
  
  if (isBlock) {
    return (
      <pre style={{
        backgroundColor: 'transparent',
        padding: '0.75rem',
        borderRadius: '0.375rem',
        overflow: 'auto',
        margin: '0.5rem 0',
        fontSize: '0.875rem',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        <code>{children}</code>
      </pre>
    );
  }
  
  return (
    <code style={{
      backgroundColor: 'transparent',
      padding: '0.125rem 0.25rem',
      borderRadius: '0.25rem',
      fontSize: '0.875rem',
      fontFamily: 'monospace'
    }}>
      {children}
    </code>
  );
};

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
            backgroundColor: 'transparent',
            padding: '0.75rem',
            borderRadius: '0.375rem',
            overflow: 'auto',
            margin: '0.5rem 0',
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
      component: TransparentCode
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
