import type { PersonDetailData } from "../api/types";
import { useT } from "../i18n/LangContext";

const ICONS: Record<string, string> = {
  born: "🎂",
  died: "🕯️",
  birthplace: "📍",
  profession: "💼",
};

function PersonFacts({ person }: { person: PersonDetailData }) {
  const t = useT();
  const facts: { key: string; labelKey: string; value: string | number }[] = [];
  if (person.birth_year !== null)
    facts.push({ key: "born", labelKey: "person.born", value: person.birth_year });
  if (person.death_year !== null)
    facts.push({ key: "died", labelKey: "person.died", value: person.death_year });
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
