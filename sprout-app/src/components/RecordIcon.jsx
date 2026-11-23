import { Activity, Baby, HeartHandshake, Hospital, Milk, Moon, PenLine, Pipette, Ruler, Soup, Sparkles, Stethoscope, Syringe, Thermometer } from "lucide-react";

const ICONS = { Activity, Baby, HeartHandshake, Hospital, Milk, Moon, PenLine, Pipette, Ruler, Soup, Sparkles, Stethoscope, Syringe, Thermometer };

export function RecordIcon({ name, ...props }) {
  const Icon = ICONS[name] ?? PenLine;
  return <Icon aria-hidden="true" {...props} />;
}
