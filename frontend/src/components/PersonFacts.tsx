import type { ReactNode } from "react";
import type { PersonDetailData } from "../api/types";
import { useT } from "../i18n/LangContext";

const svgProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// Sunrise: horizon line low, sun as an arc rising above it, with short rays.
function SunriseIcon() {
  return (
    <svg {...svgProps}>
      <line x1="3" y1="18" x2="21" y2="18" />
      <path d="M7 18a5 5 0 0 1 10 0" />
      <line x1="12" y1="5" x2="12" y2="8" />
      <line x1="5" y1="9" x2="6.5" y2="10.5" />
      <line x1="19" y1="9" x2="17.5" y2="10.5" />
    </svg>
  );
}

// Latin cross: a long vertical bar with a shorter horizontal crossbar set in
// the upper third (well above center), reading as a Christian grave marker.
function CrossIcon() {
  return (
    <svg {...svgProps}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="8" y1="8" x2="16" y2="8" />
    </svg>
  );
}

// Location pin: classic teardrop map-marker with a small circle hole.
function PinIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 21c4-4.5 6-7.9 6-10.5a6 6 0 0 0-12 0c0 2.6 2 6 6 10.5z" />
      <circle cx="12" cy="10.5" r="2" />
    </svg>
  );
}

// Briefcase: rounded rectangle body with a handle on top.
function BriefcaseIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  born: <SunriseIcon />,
  died: <CrossIcon />,
  birthplace: <PinIcon />,
  profession: <BriefcaseIcon />,
};

function PersonFacts({ person }: { person: PersonDetailData }) {
  const t = useT();
  const facts: { key: string; labelKey: string; value: string }[] = [];
  if (person.birth_date)
    facts.push({ key: "born", labelKey: "person.born", value: person.birth_date });
  if (person.death_date)
    facts.push({ key: "died", labelKey: "person.died", value: person.death_date });
  if (person.birthplace)
    facts.push({ key: "birthplace", labelKey: "person.birthplace", value: person.birthplace });
  if (person.profession)
    facts.push({ key: "profession", labelKey: "person.profession", value: person.profession });
  return (
    <dl className="person-facts">
      {facts.map((f) => (
        <div className="person-fact" key={f.key}>
          <dt>
            <span role="img" aria-label={t(f.labelKey)}>
              {ICONS[f.key]}
            </span>
          </dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default PersonFacts;
