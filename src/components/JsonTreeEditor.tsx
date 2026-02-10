import type { TranslationNode } from "../types/translation";
import TreeNode from "./TreeNode";

interface JsonTreeEditorProps {
  data: TranslationNode;
  onUpdate: (path: string[], value: string) => void;
}

export default function JsonTreeEditor({
  data,
  onUpdate,
}: JsonTreeEditorProps) {
  return (
    <div className="json-tree-editor" role="tree">
      {Object.entries(data).map(([key, value]) => (
        <TreeNode
          key={key}
          name={key}
          value={value}
          path={[key]}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}
