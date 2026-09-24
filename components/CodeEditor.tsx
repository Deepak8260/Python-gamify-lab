"use client";

import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  activeLine: number | null;
  errorLine: number | null;
  onRun: () => void;
};

type EditorT = Parameters<OnMount>[0];
type MonacoT = Parameters<OnMount>[1];

export default function CodeEditor({ value, onChange, readOnly, activeLine, errorLine, onRun }: Props) {
  const edRef = useRef<EditorT | null>(null);
  const monacoRef = useRef<MonacoT | null>(null);
  const decoRef = useRef<ReturnType<EditorT["createDecorationsCollection"]> | null>(null);
  const runRef = useRef(onRun);
  runRef.current = onRun;

  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("looplab", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "7c8aa5", fontStyle: "italic" },
        { token: "keyword", foreground: "c4b5fd" },
        { token: "number", foreground: "fbbf24" },
        { token: "string", foreground: "86efac" },
      ],
      colors: {
        "editor.background": "#0f172a",
        "editor.lineHighlightBackground": "#1e293b",
        "editorLineNumber.foreground": "#475569",
        "editorLineNumber.activeForeground": "#cbd5e1",
        "editorCursor.foreground": "#a5b4fc",
        "editor.selectionBackground": "#334155",
        "editorIndentGuide.background1": "#1e293b",
      },
    });
  };

  const onMount: OnMount = (editor, monaco) => {
    edRef.current = editor;
    monacoRef.current = monaco;
    decoRef.current = editor.createDecorationsCollection([]);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    const model = editor.getModel();
    if (model) {
      const last = model.getLineCount();
      editor.setPosition({ lineNumber: last, column: model.getLineMaxColumn(last) });
    }
    editor.focus();
  };

  useEffect(() => {
    const ed = edRef.current;
    const monaco = monacoRef.current;
    const deco = decoRef.current;
    if (!ed || !monaco || !deco) return;
    const list = [];
    if (activeLine) {
      list.push({
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: { isWholeLine: true, className: "exec-line", glyphMarginClassName: "exec-glyph" },
      });
      ed.revealLineInCenterIfOutsideViewport(activeLine);
    }
    if (errorLine) {
      list.push({
        range: new monaco.Range(errorLine, 1, errorLine, 1),
        options: { isWholeLine: true, className: "error-line", glyphMarginClassName: "error-glyph" },
      });
      ed.revealLineInCenterIfOutsideViewport(errorLine);
    }
    deco.set(list);
  }, [activeLine, errorLine]);

  return (
    <Editor
      height="100%"
      language="python"
      theme="looplab"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      beforeMount={beforeMount}
      onMount={onMount}
      loading={<div className="editor-loading">Loading editor…</div>}
      options={{
        readOnly,
        fontSize: 17,
        lineHeight: 28,
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        glyphMargin: true,
        lineNumbersMinChars: 2,
        folding: false,
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: false,
        renderLineHighlight: "line",
        padding: { top: 14, bottom: 14 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        wordBasedSuggestions: "off",
        contextmenu: false,
        automaticLayout: true,
        stickyScroll: { enabled: false },
        readOnlyMessage: { value: "The robot is running your code. Press Reset to edit." },
      }}
    />
  );
}
