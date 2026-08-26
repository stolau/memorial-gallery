import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AuthError } from "../../api/auth";
import { getFamilyLines, getPeople } from "../../api/client";
import {
  createFamilyLine,
  updateFamilyLine,
  addFamilyLineMember,
  removeFamilyLineMember,
} from "../../api/admin";
import type {
  Person,
  FamilyLine,
  FamilyLineCreate,
  FamilyLineUpdate,
} from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import { useT } from "../../i18n/LangContext";

function FamilyLineForm() {
  const t = useT();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const isEdit = slug !== undefined;

  const [name, setName] = useState("");
  const [yearRange, setYearRange] = useState("");
  const [note, setNote] = useState("");
  const [members, setMembers] = useState<FamilyLine["members"]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .catch(() => setError(t("admin.error.generic")));
  }, []);

  useEffect(() => {
    if (!slug) return;
    getFamilyLines()
      .then((lines) => {
        const line = lines.find((l) => l.slug === slug);
        if (!line) {
          setError(t("admin.error.notFound"));
          return;
        }
        setName(line.name);
        setYearRange(line.year_range ?? "");
        setNote(line.note ?? "");
        setMembers(line.members);
      })
      .catch(() => setError(t("admin.error.generic")));
  }, [slug]);

  function handleMutationError(err: unknown) {
    const s = (err as AuthError).status;
    if (s === 401) {
      clearAuth();
      return;
    }
    if (s === 404) {
      setError(t("admin.error.notFound"));
    } else {
      setError(t("admin.error.generic"));
    }
  }

  const toNullable = (raw: string): string | null => {
    const v = raw.trim();
    return v === "" ? null : v;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName === "") {
      setError(t("admin.error.nameRequired"));
      return;
    }

    const payload: FamilyLineCreate & FamilyLineUpdate = {
      name: trimmedName,
      year_range: toNullable(yearRange),
      note: toNullable(note),
    };

    try {
      if (isEdit && slug) {
        const updated = await updateFamilyLine(slug, payload);
        setName(updated.name);
        setYearRange(updated.year_range ?? "");
        setNote(updated.note ?? "");
        setMembers(updated.members);
      } else {
        const created = await createFamilyLine(payload);
        navigate(`/admin/family-lines/${created.slug}/edit`);
      }
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleAddMember = async () => {
    if (!slug || pick === "") return;
    setError(null);
    try {
      const updated = await addFamilyLineMember(slug, pick);
      setMembers(updated.members);
      setPick("");
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleRemoveMember = async (personSlug: string) => {
    if (!slug) return;
    const person = people.find((p) => p.slug === personSlug);
    if (!person) return;
    setError(null);
    try {
      const updated = await removeFamilyLineMember(slug, person.id);
      setMembers(updated.members);
    } catch (err) {
      handleMutationError(err);
    }
  };

  const memberSlugs = new Set(members.map((m) => m.slug));
  const available = people.filter((p) => !memberSlugs.has(p.slug));

  return (
    <AdminLayout>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          {t("admin.field.name")}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.yearRange")}
          <input
            type="text"
            value={yearRange}
            onChange={(e) => setYearRange(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.note")}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit">{t("admin.action.save")}</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {isEdit && slug && (
        <section className="admin-section">
          <h2>{t("admin.familyLines.members")}</h2>
          <ul className="admin-list">
            {members.map((m) => (
              <li key={m.slug}>
                <span>{m.display_name}</span>
                <span className="admin-row-actions">
                  <button type="button" onClick={() => handleRemoveMember(m.slug)}>
                    {t("admin.action.delete")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="admin-form">
            <label>
              {t("admin.familyLines.addMember")}
              <select value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">—</option>
                {available.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleAddMember}>
              {t("admin.action.create")}
            </button>
          </div>
        </section>
      )}
    </AdminLayout>
  );
}

export default FamilyLineForm;
