import { useState } from "react";
import {
  createContact,
  updateContact,
  deleteContact,
} from "../../api/admin";
import type { Contact } from "../../api/types";
import { useT } from "../../i18n/LangContext";

/* Admin editor for the multiple contact cards shown in the viewer's Info modal
   (built in PR-E). Seeded from the dashboard's GET /api/contacts; each row PUTs
   its own edits, a footer form POSTs new contacts, and mutation errors bubble
   through the shared handler so a 401 clears auth like every other mutation. */

const toNullable = (raw: string): string | null => {
  const v = raw.trim();
  return v === "" ? null : v;
};

function ContactRow({
  contact,
  onChanged,
  onError,
}: {
  contact: Contact;
  onChanged: () => void;
  onError: (err: unknown) => void;
}) {
  const t = useT();
  const [name, setName] = useState(contact.name);
  const [role, setRole] = useState(contact.role ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState(contact.email ?? "");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === "") return;
    try {
      await updateContact(contact.id, {
        name: name.trim(),
        role: toNullable(role),
        phone: toNullable(phone),
        email: toNullable(email),
      });
      onChanged();
    } catch (err) {
      onError(err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("admin.action.delete"))) return;
    try {
      await deleteContact(contact.id);
      onChanged();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <form className="admin-form admin-contact-row" onSubmit={handleSave}>
      <label>
        {t("admin.field.contactName")}
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        {t("admin.field.contactRole")}
        <input type="text" value={role} onChange={(e) => setRole(e.target.value)} />
      </label>
      <label>
        {t("admin.field.contactPhone")}
        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        {t("admin.field.contactEmail")}
        <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <span className="admin-row-actions">
        <button type="submit">{t("admin.action.save")}</button>
        <button type="button" onClick={handleDelete}>
          {t("admin.action.delete")}
        </button>
      </span>
    </form>
  );
}

function ContactForm({
  contacts,
  onChanged,
  onError,
}: {
  contacts: Contact[];
  onChanged: () => void;
  onError: (err: unknown) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError(t("admin.error.nameRequired"));
      return;
    }
    try {
      await createContact({
        name: name.trim(),
        role: toNullable(role),
        phone: toNullable(phone),
        email: toNullable(email),
      });
      setName("");
      setRole("");
      setPhone("");
      setEmail("");
      onChanged();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="admin-contacts">
      <ul className="admin-list">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <ContactRow contact={contact} onChanged={onChanged} onError={onError} />
          </li>
        ))}
      </ul>
      <form className="admin-form admin-contact-row" onSubmit={handleAdd}>
        <label>
          {t("admin.field.contactName")}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t("admin.field.contactRole")}
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label>
          {t("admin.field.contactPhone")}
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          {t("admin.field.contactEmail")}
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit">{t("admin.action.new")}</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </div>
  );
}

export default ContactForm;
