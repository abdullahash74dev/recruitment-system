import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical } from "lucide-react";

export interface EditableOption {
  id: string;
  ar: string;
  en: string;
  enabled: boolean;
}

interface SortableItemProps {
  item: EditableOption;
  locked: boolean;
  lang: string;
  onToggle: (id: string) => void;
  onUpdate: (id: string, field: "ar" | "en", value: string) => void;
  onRemove: (id: string) => void;
}

const SortableItem = ({ item, locked, lang, onToggle, onUpdate, onRemove }: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
        item.enabled ? "bg-background border-border" : "bg-muted/50 border-muted opacity-60"
      }`}
    >
      {!locked && (
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" style={{ touchAction: "none" }}>
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <Switch checked={item.enabled} onCheckedChange={() => onToggle(item.id)} disabled={locked} />
      <div className="flex-1 grid grid-cols-2 gap-2">
        <Input value={item.ar} onChange={(e) => onUpdate(item.id, "ar", e.target.value)} className="text-sm h-8" dir="rtl" placeholder={lang === "ar" ? "عربي" : "Arabic"} disabled={locked} />
        <Input value={item.en} onChange={(e) => onUpdate(item.id, "en", e.target.value)} className="text-sm h-8" dir="ltr" placeholder={lang === "ar" ? "إنجليزي" : "English"} disabled={locked} />
      </div>
      {!locked && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onRemove(item.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

export default SortableItem;
