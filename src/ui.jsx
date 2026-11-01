import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Upload,
  FileText,
  Check,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { fieldTypes, money, uid } from "./model.js";
import { storeFile, downloadFile } from "./files.js";
let openModalCount = 0;
let previousBodyOverflow = "";
export function Button({
  children,
  icon: Icon,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`button ${variant} ${className}`}
      {...props}
    >
      {Icon && <Icon size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}
export function IconButton({ icon: Icon, label, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({ name, size = "normal" }) {
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
export function Card({ children, className = "", ...props }) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  );
}
export function Empty({ title, description, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
  footer,
}) {
  const ref = useRef(),
    titleId = useRef(uid()).current,
    closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const d = ref.current;
    if (openModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openModalCount += 1;
    d.showModal();
    const close = (e) => {
      e.preventDefault();
      closeRef.current();
    };
    d.addEventListener("cancel", close);
    return () => {
      d.removeEventListener("cancel", close);
      d.close();
      openModalCount -= 1;
      if (openModalCount === 0) document.body.style.overflow = previousBodyOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon={X} label="Закрыть окно" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </dialog>
  );
}
export function Label({ children, hint }) {
  return (
    <span className="field-label">
      {children}
      {hint && <span className="hint">{hint}</span>}
    </span>
  );
}
export function Input({ label, hint, className = "", ...props }) {
  const id = useRef(uid()).current;
  return (
    <label className={`field ${className}`} htmlFor={id}>
      <Label hint={hint}>{label}</Label>
      <input id={id} {...props} />
    </label>
  );
}
export function Select({ label, children, className = "", ...props }) {
  const id = useRef(uid()).current;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>
        <Label>{label}</Label>
      </label>
      <span className="select-wrap">
        <select id={id} {...props}>
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
    </div>
  );
}
export function TextArea({ label, ...props }) {
  const id = useRef(uid()).current;
  return (
    <label className="field" htmlFor={id}>
      <Label>{label}</Label>
      <textarea id={id} rows={3} {...props} />
    </label>
  );
}
export function Attachment({ file, onRemove }) {
  return (
    <span className="attachment">
      <FileText size={15} aria-hidden="true" />
      {file.id ? (
        <button type="button" onClick={() => downloadFile(file)}>
          {file.name}
        </button>
      ) : (
        <span>{file.name}</span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Удалить ${file.name}`}
          onClick={onRemove}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
export function DynamicField({
  field,
  value,
  onChange,
  error,
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState("");
  const id = `field-${field.id}`,
    errId = `error-${field.id}`;
  const common = {
    id,
    disabled,
    required: field.required,
    "aria-invalid": !!(error || uploadError),
    "aria-describedby": error || uploadError ? errId : undefined,
  };
  async function upload(e) {
    const files = Array.from(e.target.files || []);
    setUploadError("");
    if (files.some((f) => f.size > 10 * 1024 * 1024)) {
      setUploadError("Максимальный размер файла – 10 МБ");
      return;
    }
    if (
      field.type === "photo" &&
      files.some((f) => !f.type.startsWith("image/"))
    ) {
      setUploadError("Выберите изображения");
      return;
    }
    setUploading(true);
    try {
      const saved = await Promise.all(files.map(storeFile));
      onChange([...(value || []), ...saved]);
    } catch {
      setUploadError("Не удалось сохранить файл – попробуйте ещё раз");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  return (
    <div className={`field ${error || uploadError ? "has-error" : ""}`}>
      <label className="field-label" htmlFor={id}>
        {field.label}
        {field.required && <span className="required">*</span>}
      </label>
      {["photo", "file"].includes(field.type) ? (
        <>
          <label
            className={`upload ${disabled ? "disabled" : ""}`}
            htmlFor={id}
          >
            <Upload size={22} aria-hidden="true" />
            <strong>
              {uploading
                ? "Сохраняем файлы…"
                : field.type === "photo"
                  ? "Добавить фотографии"
                  : "Добавить файлы"}
            </strong>
            <small>
              {field.required ? `Минимум ${field.min || 1} · ` : ""}до 10 МБ
              каждый
            </small>
            <input
              {...common}
              type="file"
              accept={field.type === "photo" ? "image/*" : undefined}
              multiple
              disabled={disabled || uploading}
              onChange={upload}
              required={false}
            />
          </label>
          <div className="attachments">
            {(value || []).map((f, i) => (
              <Attachment
                key={f.id || i}
                file={f}
                onRemove={
                  disabled
                    ? null
                    : () => onChange(value.filter((_, j) => j !== i))
                }
              />
            ))}
          </div>
        </>
      ) : field.type === "textarea" ? (
        <textarea
          {...common}
          rows={3}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          {...common}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Выберите вариант</option>
          {field.options
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
      ) : field.type === "multiselect" ? (
        <div className="choices">
          {field.options
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={(value || []).includes(s)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...(value || []), s]
                        : (value || []).filter((v) => v !== s),
                    )
                  }
                />
                {s}
              </label>
            ))}
        </div>
      ) : (
        <input
          {...common}
          type={
            field.type === "date"
              ? "date"
              : ["number", "money"].includes(field.type)
                ? "number"
                : field.type === "link"
                  ? "url"
                  : "text"
          }
          min={["number", "money"].includes(field.type) ? 0 : undefined}
          step={field.type === "money" ? "0.01" : undefined}
          value={value ?? ""}
          placeholder={field.type === "link" ? "https://…" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {(error || uploadError) && (
        <small id={errId} className="error-text">
          {error || uploadError}
        </small>
      )}
    </div>
  );
}
export function FieldEditor({ field, onChange, onDelete, showRole = false }) {
  return (
    <div className="field-editor">
      <div className="field-editor-top">
        <Input
          label="Название поля"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
        <Select
          label="Тип поля"
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value })}
        >
          {Object.entries(fieldTypes).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </Select>
        <IconButton icon={X} label="Удалить поле" onClick={onDelete} />
      </div>
      <div className="field-editor-bottom">
        <label className="check">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          Обязательное поле
        </label>
        {showRole && (
          <Select
            label="Заполняет"
            value={field.role}
            onChange={(e) => onChange({ ...field, role: e.target.value })}
          >
            <option value="client">Клиент</option>
            <option value="executor">Исполнитель</option>
          </Select>
        )}
        {["photo", "file"].includes(field.type) && (
          <Input
            label="Минимум файлов"
            type="number"
            min="1"
            max="20"
            value={field.min || 1}
            onChange={(e) =>
              onChange({ ...field, min: Number(e.target.value) })
            }
          />
        )}
      </div>
      {["select", "multiselect"].includes(field.type) && (
        <Input
          label="Варианты через запятую"
          value={field.options}
          onChange={(e) => onChange({ ...field, options: e.target.value })}
        />
      )}
    </div>
  );
}
export function Progress({ value }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Готовность проекта"
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export function SectionTitle({ title, description, children }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
