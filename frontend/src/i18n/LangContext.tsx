import { createContext, useContext, useState, type ReactNode } from "react";
import { strings, type Lang } from "./strings";

const STORAGE_KEY = "lang";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "fi",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "fi",
  );
  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };
  return (
    <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);

export function useT() {
  const { lang } = useLang();
  return (key: string): string => strings[lang][key] ?? strings.fi[key] ?? key;
}
