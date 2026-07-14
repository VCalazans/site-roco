"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ContactModal, type ContactModalContent } from "./contact-modal";

type ContactFormContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const ContactFormContext = createContext<ContactFormContextValue | null>(null);

type ContactFormProviderProps = {
  children: ReactNode;
  content: ContactModalContent;
};

export function ContactFormProvider({ children, content }: ContactFormProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <ContactFormContext.Provider value={value}>
      {children}
      <ContactModal isOpen={isOpen} onClose={close} content={content} />
    </ContactFormContext.Provider>
  );
}

export function useContactForm() {
  const context = useContext(ContactFormContext);
  if (!context) {
    throw new Error("useContactForm must be used within a ContactFormProvider");
  }
  return context;
}
