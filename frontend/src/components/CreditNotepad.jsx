import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FiEdit3, FiSave } from "react-icons/fi";
import {
  CREDIT_NOTEPAD_SECTIONS,
  creditNotepadService,
} from "../services/creditNotepadService";

const DEFAULT_SANCTION_KEY = "general";

const NOTE_DEFINITIONS = [
  {
    section: CREDIT_NOTEPAD_SECTIONS.CREDIT_MAKER,
    title: "Recommendation",
    editRoles: ["credit_team_l1", "credit_team_l2"],
    placeholder: "Write recommendation notes...",
  },
];

const VIEW_ROLES = ["credit_team_l1", "credit_team_l2"];

const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "COL",
  "COLGROUP",
  "DIV",
  "EM",
  "I",
  "LI",
  "OL",
  "P",
  "S",
  "SPAN",
  "STRONG",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "colspan",
  "href",
  "rowspan",
  "style",
  "target",
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-collapse",
  "border-left",
  "border-right",
  "border-top",
  "color",
  "font-style",
  "font-weight",
  "height",
  "margin",
  "padding",
  "text-align",
  "text-decoration",
  "vertical-align",
  "white-space",
  "width",
]);

const normalizeRole = (role) => {
  if (!role) return "";
  if (typeof role === "string") return role.toLowerCase();
  return (role.name || "").toLowerCase();
};

const getUserRoles = (user) => {
  const roles = [
    normalizeRole(user?.role),
    normalizeRole(user?.defaultRole),
    ...(user?.roles || []).map(normalizeRole),
  ].filter(Boolean);

  return [...new Set(roles)];
};

const normalizeSanctionKey = (value) => {
  const key = (value || "").toString().trim();
  return key || DEFAULT_SANCTION_KEY;
};

const normalizeSanctions = (sanctions = []) => {
  const sanctionMap = new Map();

  sanctions.forEach((sanction) => {
    const key = normalizeSanctionKey(
      typeof sanction === "string"
        ? sanction
        : sanction?.key || sanction?.code || sanction?.partner || sanction?.id,
    );
    const name =
      typeof sanction === "string"
        ? sanction
        : sanction?.name || sanction?.partnerName || sanction?.label || key;

    if (!sanctionMap.has(key)) {
      sanctionMap.set(key, { key, name });
    }
  });

  if (sanctionMap.size === 0) {
    sanctionMap.set(DEFAULT_SANCTION_KEY, {
      key: DEFAULT_SANCTION_KEY,
      name: "General Sanction",
    });
  }

  return Array.from(sanctionMap.values());
};

const createEmptyNote = (section, sanctionKey) => ({
  content: "",
  sanctionKey,
  section,
  updatedAt: null,
  updatedByName: null,
});

const createEmptyNotesForSanctions = (sanctions) =>
  sanctions.reduce((acc, sanction) => {
    acc[sanction.key] = NOTE_DEFINITIONS.reduce((sectionAcc, definition) => {
      sectionAcc[definition.section] = createEmptyNote(
        definition.section,
        sanction.key,
      );
      return sectionAcc;
    }, {});
    return acc;
  }, {});

const createSavedContentForNotes = (notes) =>
  Object.entries(notes).reduce((acc, [sanctionKey, sectionNotes]) => {
    acc[sanctionKey] = NOTE_DEFINITIONS.reduce((sectionAcc, definition) => {
      sectionAcc[definition.section] =
        sectionNotes?.[definition.section]?.content || "";
      return sectionAcc;
    }, {});
    return acc;
  }, {});

const ensureSavedContentForSanctions = (savedContent, sanctions) => {
  const nextSavedContent = { ...savedContent };

  sanctions.forEach((sanction) => {
    if (!nextSavedContent[sanction.key]) {
      nextSavedContent[sanction.key] = {};
    }

    NOTE_DEFINITIONS.forEach((definition) => {
      if (nextSavedContent[sanction.key][definition.section] === undefined) {
        nextSavedContent[sanction.key][definition.section] = "";
      }
    });
  });

  return nextSavedContent;
};

const ensureNotesForSanctions = (notes, sanctions) => {
  const nextNotes = { ...notes };

  sanctions.forEach((sanction) => {
    if (!nextNotes[sanction.key]) {
      nextNotes[sanction.key] = {};
    }

    NOTE_DEFINITIONS.forEach((definition) => {
      if (!nextNotes[sanction.key][definition.section]) {
        nextNotes[sanction.key][definition.section] = createEmptyNote(
          definition.section,
          sanction.key,
        );
      }
    });
  });

  return nextNotes;
};

const formatSavedAt = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return `Saved ${date.toLocaleString()}`;
};

const cleanStyle = (styleValue) =>
  styleValue
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const [property, ...valueParts] = part.split(":");
      const propertyName = property?.trim().toLowerCase();
      const propertyValue = valueParts.join(":").toLowerCase();
      return (
        ALLOWED_STYLE_PROPERTIES.has(propertyName) &&
        !propertyValue.includes("expression") &&
        !propertyValue.includes("javascript:") &&
        !propertyValue.includes("url(")
      );
    })
    .join("; ");

const extractClipboardFragment = (html) => {
  const startMarker = "<!--StartFragment-->";
  const endMarker = "<!--EndFragment-->";
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return html;
  }

  return html.slice(startIndex + startMarker.length, endIndex);
};

const stripOfficeClipboardMarkup = (value) =>
  (value || "")
    .replace(/<!--StartFragment-->|<!--EndFragment-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&lt;!--StartFragment--&gt;|&lt;!--EndFragment--&gt;/gi, "")
    .replace(/&lt;!--[\s\S]*?--&gt;/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&lt;style[\s\S]*?&lt;\/style&gt;/gi, "")
    .replace(/<xml[\s\S]*?<\/xml>/gi, "")
    .replace(/&lt;xml[\s\S]*?&lt;\/xml&gt;/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/&lt;meta[^&]*&gt;/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/&lt;link[^&]*&gt;/gi, "")
    .replace(/<\/?o:[^>]*>/gi, "")
    .replace(/<\/?w:[^>]*>/gi, "")
    .replace(/<\/?m:[^>]*>/gi, "")
    .replace(/\/\*\s*Font Definitions\s*\*\/[\s\S]*?\/\*\s*Style Definitions\s*\*\//gi, "")
    .replace(/@font-face\s*\{[\s\S]*?\}/gi, "")
    .replace(/@page\s+[^{]+\{[\s\S]*?\}/gi, "");

const prepareClipboardHtml = (html) =>
  stripOfficeClipboardMarkup(extractClipboardFragment(html));

const prepareClipboardText = (text) =>
  stripOfficeClipboardMarkup(text).trim();

const sanitizeNode = (node) => {
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const element = child;

    if (!ALLOWED_TAGS.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }
      element.replaceWith(fragment);
      sanitizeNode(node);
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value || "";
      const isEventHandler = name.startsWith("on");
      const isUnsafeLink =
        (name === "href" || name === "src") &&
        value.trim().toLowerCase().startsWith("javascript:");

      if (
        isEventHandler ||
        isUnsafeLink ||
        !ALLOWED_ATTRIBUTES.has(name)
      ) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (name === "style") {
        const cleanValue = cleanStyle(value);
        if (cleanValue) {
          element.setAttribute("style", cleanValue);
        } else {
          element.removeAttribute("style");
        }
      }

      if (name === "target") {
        element.setAttribute("rel", "noopener noreferrer");
      }
    });

    sanitizeNode(element);
  });
};

const sanitizeHtml = (html) => {
  const template = document.createElement("template");
  template.innerHTML = prepareClipboardHtml(html || "");
  sanitizeNode(template.content);
  return template.innerHTML;
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const insertHtmlAtCursor = (html) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const fragment = range.createContextualFragment(html);
  const lastChild = fragment.lastChild;
  range.insertNode(fragment);

  if (lastChild) {
    range.setStartAfter(lastChild);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  return true;
};

const RichNoteEditor = ({
  disabled,
  onChange,
  placeholder,
  readOnly,
  value,
}) => {
  const editorRef = useRef(null);
  const isEditable = !disabled && !readOnly;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextValue = value || "";
    if (editor.innerHTML !== nextValue && document.activeElement !== editor) {
      editor.innerHTML = nextValue;
    }
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    onChange(sanitizeHtml(editor?.innerHTML || ""));
  };

  const handlePaste = (event) => {
    if (!isEditable) return;

    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const cleanText = prepareClipboardText(text);
    const pasteHtml = html || escapeHtml(cleanText).replace(/\r?\n/g, "<br>");

    if (!pasteHtml) return;

    event.preventDefault();
    insertHtmlAtCursor(sanitizeHtml(pasteHtml));
    emitChange();
  };

  return (
    <div
      ref={editorRef}
      className={`rich-note-editor input-field ${isEditable ? "" : "bg-white text-gray-700"}`}
      contentEditable={isEditable}
      data-placeholder={placeholder}
      onBlur={emitChange}
      onInput={emitChange}
      onPaste={handlePaste}
      role="textbox"
      suppressContentEditableWarning
    />
  );
};

const CreditNotepad = ({ customerId, sanctions = [] }) => {
  const { user } = useSelector((state) => state.auth);
  const userRoles = useMemo(() => getUserRoles(user), [user]);
  const sanctionItems = useMemo(
    () => normalizeSanctions(sanctions),
    [sanctions],
  );
  const canView = userRoles.some((role) => VIEW_ROLES.includes(role));

  const [notes, setNotes] = useState(() =>
    createEmptyNotesForSanctions(sanctionItems),
  );
  const [savedContent, setSavedContent] = useState(() =>
    createSavedContentForNotes(createEmptyNotesForSanctions(sanctionItems)),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    setNotes((previous) => ensureNotesForSanctions(previous, sanctionItems));
    setSavedContent((previous) =>
      ensureSavedContentForSanctions(previous, sanctionItems),
    );
  }, [sanctionItems]);

  useEffect(() => {
    if (!customerId || !canView) return;

    const loadNotes = async () => {
      setIsLoading(true);
      try {
        const response = await creditNotepadService.getCustomerNotepads(
          customerId,
        );
        const responseNotes = Object.entries(response || {}).reduce(
          (acc, [sanctionKey, sectionNotes]) => {
            acc[sanctionKey] = NOTE_DEFINITIONS.reduce(
              (sectionAcc, definition) => {
                sectionAcc[definition.section] =
                  sectionNotes?.[definition.section] ||
                  createEmptyNote(definition.section, sanctionKey);
                return sectionAcc;
              },
              {},
            );
            return acc;
          },
          {},
        );

        const nextNotes = ensureNotesForSanctions(
          responseNotes,
          sanctionItems,
        );
        setNotes(nextNotes);
        setSavedContent(createSavedContentForNotes(nextNotes));
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to load credit notepad",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadNotes();
  }, [customerId, canView, sanctionItems]);

  if (!canView) return null;

  const canEditSection = (definition) =>
    definition.editRoles.some((role) => userRoles.includes(role));

  const handleChange = (sanctionKey, section, value) => {
    setNotes((previous) => ({
      ...previous,
      [sanctionKey]: {
        ...previous[sanctionKey],
        [section]: {
          ...previous[sanctionKey]?.[section],
          content: value,
          sanctionKey,
          section,
        },
      },
    }));
  };

  const handleSave = async (sanctionKey, section) => {
    const nextSavingKey = `${sanctionKey}:${section}`;
    setSavingKey(nextSavingKey);
    try {
      const savedNote = await creditNotepadService.updateCustomerNotepad(
        customerId,
        sanctionKey,
        section,
        notes[sanctionKey]?.[section]?.content || "",
      );

      setNotes((previous) => ({
        ...previous,
        [sanctionKey]: {
          ...previous[sanctionKey],
          [section]: {
            ...previous[sanctionKey]?.[section],
            content: savedNote?.content || "",
            sanctionKey,
            section,
            updatedAt: savedNote?.updatedAt || new Date().toISOString(),
            updatedByName: savedNote?.updatedByName || user?.name || null,
          },
        },
      }));
      setSavedContent((previous) => ({
        ...previous,
        [sanctionKey]: {
          ...previous[sanctionKey],
          [section]: savedNote?.content || "",
        },
      }));
      toast.success("Notepad saved");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to save credit notepad",
      );
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="card border-l-4 border-primary-500">
      <div className="flex items-center space-x-2 mb-4">
        <FiEdit3 className="h-5 w-5 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">
          Credit Notepad
        </h2>
      </div>

      <div className="space-y-5">
        {sanctionItems.map((sanction) => (
          <div
            key={sanction.key}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {sanction.name}
              </h3>
              <span className="rounded bg-white px-2 py-1 text-xs font-semibold uppercase text-gray-500">
                {sanction.key}
              </span>
            </div>

            <div className="space-y-4">
              {NOTE_DEFINITIONS.map((definition) => {
                const note =
                  notes[sanction.key]?.[definition.section] ||
                  createEmptyNote(definition.section, sanction.key);
                const isEditable = canEditSection(definition);
                const isDirty =
                  note.content !==
                  (savedContent[sanction.key]?.[definition.section] || "");
                const noteSavingKey = `${sanction.key}:${definition.section}`;
                const isSaving = savingKey === noteSavingKey;

                return (
                  <div
                    key={definition.section}
                    className="rounded border border-gray-200 bg-white p-3"
                  >
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        {definition.title && (
                          <h4 className="text-sm font-bold text-gray-800">
                            {definition.title}
                          </h4>
                        )}
                        {formatSavedAt(note.updatedAt) && (
                          <p className="text-xs text-gray-500">
                            {formatSavedAt(note.updatedAt)}
                            {note.updatedByName
                              ? ` by ${note.updatedByName}`
                              : ""}
                          </p>
                        )}
                      </div>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSave(sanction.key, definition.section)
                          }
                          disabled={isLoading || isSaving || !isDirty}
                          className="inline-flex items-center justify-center space-x-2 rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          <FiSave className="h-4 w-4" />
                          <span>{isSaving ? "Saving" : "Save"}</span>
                        </button>
                      )}
                    </div>

                    <RichNoteEditor
                      disabled={isLoading}
                      onChange={(value) =>
                        handleChange(
                          sanction.key,
                          definition.section,
                          value,
                        )
                      }
                      placeholder={definition.placeholder}
                      readOnly={!isEditable}
                      value={note.content}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreditNotepad;
