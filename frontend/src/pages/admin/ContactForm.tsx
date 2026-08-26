import { useState } from "react";
import { updateContact } from "../../api/admin";
import type { Contact } from "../../api/types";
import { useT } from "../../i18n/LangContext";

/* Small admin form for the navbar contact info. Lives inside the admin
   dashboard; seeded from the initial GET /api/contact and PUTs the three
   fields on save. Mutation errors are surfaced through the shared handler
   so a 401 clears auth like every other dashboard mutation. */
function ContactForm({
  initial,
  onError,
}: {
  initial: Contact;
  onError: (err: unknown) => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial.contact_name ?? "");
  const [email, setEmail] = useState(initial.contact_email ?? "");
  const [phone, setPhone] = useState(initial.contact_phone ?? "");
  const [saved, setSaved] = useState(false);

  const toNullable = (raw: string): string | null => {
    const v = raw.trim();
    return v === "" ? null : v;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    try {
      const updated = await updateContact({
        contact_name: toNullable(name),
        contact_email: toNullable(email),
        contact_phone: toNullable(phone),
      });
      setName(updated.contact_name ?? "");
      setEmail(updated.contact_email ?? "");
      setPhone(updated.contact_phone ?? "");
      setSaved(true);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label>
        {t("admin.field.contactName")}
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setSaved(false);
            setName(e.target.value);
          }}
        />
      </label>
      <label>
        {t("admin.field.contactEmail")}
        <input
          type="text"
          value={email}
          onChange={(e) => {
            setSaved(false);
            setEmail(e.target.value);
          }}
        />
      </label>
      <label>
        {t("admin.field.contactPhone")}
        <input
          type="text"
          value={phone}
          onChange={(e) => {
            setSaved(false);
            setPhone(e.target.value);
          }}
        />
      </label>
      <button type="submit">{t("admin.action.save")}</button>
      {saved && <p className="admin-saved">{t("admin.contact.saved")}</p>}
    </form>
  );
}

export default ContactForm;
