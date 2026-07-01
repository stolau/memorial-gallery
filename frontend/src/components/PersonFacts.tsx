import type { PersonDetailData } from "../api/types";
import { useT } from "../i18n/LangContext";

function PersonFacts({ person }: { person: PersonDetailData }) {
  const t = useT();
  return (
    <ul>
      {person.birth_year !== null && (
        <li>{t("person.born")}: {person.birth_year}</li>
      )}
      {person.death_year !== null && (
        <li>{t("person.died")}: {person.death_year}</li>
      )}
      {person.birthplace && (
        <li>{t("person.birthplace")}: {person.birthplace}</li>
      )}
      {person.profession && (
        <li>{t("person.profession")}: {person.profession}</li>
      )}
    </ul>
  );
}

export default PersonFacts;
