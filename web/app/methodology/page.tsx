import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMethodology } from '@/lib/data';
import { headingId } from '@/lib/format';

interface HeadingChild {
  props?: { children?: React.ReactNode };
}

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  const node = children as HeadingChild;
  if (node && node.props && node.props.children !== undefined) {
    return extractText(node.props.children);
  }
  return '';
}

export const metadata = {
  title: 'Methodology — Connected Procurement',
};

export default async function MethodologyPage() {
  const md = await getMethodology();

  return (
    <article className="methodology max-w-3xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => {
            const id = headingId(extractText(children));
            return <h1 id={id}>{children}</h1>;
          },
          h2: ({ children }) => {
            const id = headingId(extractText(children));
            return <h2 id={id}>{children}</h2>;
          },
          h3: ({ children }) => {
            const id = headingId(extractText(children));
            return <h3 id={id}>{children}</h3>;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </article>
  );
}
