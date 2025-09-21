import React from "react";
import { useTranslation } from "react-i18next";
import "./PageTranslator.css";

const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिंदी" }
];

const PageTranslator = () => {
    const { i18n } = useTranslation();

    return (
        <div className="page-translator">
            {LANGUAGES.map((lang) => (
                <button
                    key={lang.code}
                    className={`translator-btn${i18n.language === lang.code ? " active" : ""}`}
                    onClick={() => i18n.changeLanguage(lang.code)}
                >
                    {lang.label}
                </button>
            ))}
        </div>
    );
};

export default PageTranslator;