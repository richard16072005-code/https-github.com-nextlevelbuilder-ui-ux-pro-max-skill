import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, List, ListOrdered, Quote, Strikethrough } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cx } from './ui';

export function RichText({ value, onChange, placeholder = 'Write something…', minimal }: { value: string; onChange: (html: string) => void; placeholder?: string; minimal?: boolean }) {
  const timer = useRef<number>();
  const latest = useRef(onChange);
  latest.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : placeholder),
        showOnlyCurrent: false,
      }),
    ],
    content: value,
    editorProps: { attributes: { class: 'prose-ledger min-h-[80px]' } },
    onUpdate: ({ editor }) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current(editor.getHTML()), 350);
    },
    onBlur: ({ editor }) => {
      window.clearTimeout(timer.current);
      latest.current(editor.getHTML());
    },
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="group/rt relative">
      {!minimal && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx('grid size-7 place-items-center rounded-md transition-colors', active ? 'bg-hover text-ink' : 'text-ink-3 hover:bg-hover hover:text-ink')}
    >
      {icon}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="sticky top-2 z-10 mb-3 flex w-fit items-center gap-0.5 rounded-lg border border-line bg-[#171716]/95 p-0.5 opacity-60 backdrop-blur transition-opacity group-focus-within/rt:opacity-100 hover:opacity-100">
      {btn(editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), <Heading2 size={15} />, 'Heading')}
      {btn(editor.isActive('bold'), () => c().toggleBold().run(), <Bold size={14} />, 'Bold (⌘B)')}
      {btn(editor.isActive('italic'), () => c().toggleItalic().run(), <Italic size={14} />, 'Italic (⌘I)')}
      {btn(editor.isActive('strike'), () => c().toggleStrike().run(), <Strikethrough size={14} />, 'Strikethrough')}
      <span className="mx-0.5 h-4 w-px bg-line-2" />
      {btn(editor.isActive('bulletList'), () => c().toggleBulletList().run(), <List size={15} />, 'Bullet list')}
      {btn(editor.isActive('orderedList'), () => c().toggleOrderedList().run(), <ListOrdered size={15} />, 'Numbered list')}
      {btn(editor.isActive('blockquote'), () => c().toggleBlockquote().run(), <Quote size={14} />, 'Quote')}
    </div>
  );
}
