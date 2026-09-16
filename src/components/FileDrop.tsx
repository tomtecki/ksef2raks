import { useRef, useState, type DragEvent } from "react";

interface Props {
  onFiles: (files: FileList) => void;
}

export default function FileDrop({ onFiles }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stop = (e: DragEvent) => e.preventDefault();

  return (
    <div
      className={`drop${over ? " over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => {
        stop(e);
        setOver(true);
      }}
      onDragOver={stop}
      onDragLeave={(e) => {
        stop(e);
        setOver(false);
      }}
      onDrop={(e) => {
        stop(e);
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
    >
      <svg className="drop-icon" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1Z"
        />
        <path fill="currentColor" d="M5 15a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2a1 1 0 1 1 2 0v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2a1 1 0 0 1 1-1Z" />
      </svg>
      <div>
        <strong>Przeciągnij tu pliki z KSeF</strong> albo kliknij, aby wybrać
      </div>
      <div className="drop-hint">Pliki XML pojedynczo lub archiwum ZIP z paczką faktur – można wiele naraz</div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml,.zip,text/xml,application/xml,application/zip"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
